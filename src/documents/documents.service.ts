import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Pool } from 'pg';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmImportDto } from './dto/confirm-import.dto';

interface ExtractedIncident {
  title: string;
  problem: string | null;
  cause: string | null;
  solution: string | null;
  prevention: string | null;
  severity: 'low' | 'medium' | 'high';
  resolutionSteps?: string[];
}

interface SimilarJob {
  jobId: string;
  jobTitle: string;
  incidentTitle: string;
  similarity: number;
}

export interface PreviewIncident extends ExtractedIncident {
  resolutionSteps: string[];
  suggestion: 'new_job' | 'attach_existing';
  similarJob: SimilarJob | null;
}

const SIMILARITY_THRESHOLD = 0.75;

@Injectable()
export class DocumentsService implements OnModuleDestroy {
  private readonly openai: OpenAI;
  private readonly pgPool: Pool;
  private readonly pgSchema: string;
  private readonly embeddingModel: string;
  private readonly chatModel: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openai = new OpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
    this.embeddingModel = config.get<string>('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';
    this.chatModel = config.get<string>('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini';
    const dbUrl = config.getOrThrow<string>('DATABASE_URL');
    this.pgSchema = new URL(dbUrl).searchParams.get('schema') ?? 'public';
    this.pgPool = new Pool({ connectionString: dbUrl });
  }

  async onModuleDestroy() {
    await this.pgPool.end();
  }

  async parseDocument(teamId: string, text: string) {
    const completion = await this.openai.chat.completions.create({
      model: this.chatModel,
      messages: [
        {
          role: 'system',
          content: `You are a maintenance incident extraction assistant.
Analyze the provided maintenance document and:
1. Extract every distinct incident, problem, failure, fault, or issue described
2. Suggest a concise task title that summarises what this document is about overall
3. Suggest a brief task description (1-2 sentences)

For each incident extract:
- "title": concise English summary (required)
- "problem": what went wrong / symptom (or null)
- "cause": root cause, if mentioned (or null)
- "solution": overall solution summary, if mentioned (or null)
- "prevention": how to avoid recurrence, if mentioned (or null)
- "severity": "low" | "medium" | "high" based on described impact
- "resolutionSteps": ordered array of concrete action steps a technician must perform to resolve this incident — extract these from any numbered lists, step-by-step instructions, or resolution procedures in the text. If no explicit steps are described, derive 2-4 logical steps from the solution. Always return at least one step.

If a passage covers both a problem and its solution, combine them into one incident.
Return ONLY valid JSON:
{
  "suggestedJobTitle": string,
  "suggestedJobDescription": string,
  "incidents": [{ "title": string, "problem": string|null, "cause": string|null, "solution": string|null, "prevention": string|null, "severity": "low"|"medium"|"high", "resolutionSteps": string[] }]
}`,
        },
        { role: 'user', content: text.slice(0, 8000) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    let parsed: {
      suggestedJobTitle?: string;
      suggestedJobDescription?: string;
      incidents?: ExtractedIncident[];
    };
    try {
      parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{"incidents":[]}');
    } catch {
      parsed = { incidents: [] };
    }

    const rawIncidents = (parsed.incidents ?? []).filter((i) => i.title?.trim());
    const suggestedJobTitle = parsed.suggestedJobTitle?.trim() || 'Imported Document';
    const suggestedJobDescription = parsed.suggestedJobDescription?.trim() || '';

    // For each extracted incident, embed and search for similar existing incidents in the team
    const previewIncidents: PreviewIncident[] = [];

    for (const inc of rawIncidents) {
      const embText = [
        inc.title,
        inc.problem  ? `Problem: ${inc.problem}`   : '',
        inc.cause    ? `Cause: ${inc.cause}`        : '',
        inc.solution ? `Solution: ${inc.solution}`  : '',
      ].filter(Boolean).join(' | ');

      let similarJob: SimilarJob | null = null;

      try {
        const embResponse = await this.openai.embeddings.create({
          model: this.embeddingModel,
          input: embText,
        });
        const vector = embResponse.data[0]?.embedding;

        if (vector) {
          const result = await this.pgPool.query<{
            jobId: string;
            jobTitle: string;
            incidentTitle: string;
            similarity: number;
          }>(
            `SELECT i."jobId", j."title" as "jobTitle", i."title" as "incidentTitle",
                    1 - (ie.embedding <=> $1::vector) as similarity
             FROM "${this.pgSchema}"."IncidentEmbedding" ie
             JOIN "${this.pgSchema}"."Incident" i ON i.id = ie."incidentId"
             JOIN "${this.pgSchema}"."Job" j ON j.id = i."jobId"
             WHERE ie."teamId" = $2
             ORDER BY ie.embedding <=> $1::vector
             LIMIT 1`,
            [`[${vector.join(',')}]`, teamId],
          );

          const top = result.rows[0];
          if (top && top.similarity >= SIMILARITY_THRESHOLD) {
            similarJob = {
              jobId: top.jobId,
              jobTitle: top.jobTitle,
              incidentTitle: top.incidentTitle,
              similarity: Math.round(top.similarity * 100),
            };
          }
        }
      } catch {
        // similarity search failure is non-fatal — preview continues without a match
      }

      const severity = (['low', 'medium', 'high'] as const).includes(inc.severity)
        ? inc.severity
        : 'medium';

      previewIncidents.push({
        ...inc,
        severity,
        resolutionSteps: inc.resolutionSteps ?? [],
        suggestion: similarJob ? 'attach_existing' : 'new_job',
        similarJob,
      });
    }

    return { suggestedJobTitle, suggestedJobDescription, incidents: previewIncidents };
  }

  async confirmImport(teamId: string, userId: string, dto: ConfirmImportDto) {
    let jobId: string;
    let newJobCreated = false;

    if (dto.action === 'new_job') {
      const job = await this.prisma.job.create({
        data: {
          teamId,
          title: dto.newJobTitle?.trim() || 'Imported Document',
          description: dto.newJobDescription?.trim() || null,
          status: 'open',
        },
      });
      jobId = job.id;
      newJobCreated = true;
    } else {
      if (!dto.existingJobId) throw new NotFoundException('existingJobId is required when action is attach_existing');
      const job = await this.prisma.job.findFirst({ where: { id: dto.existingJobId, teamId } });
      if (!job) throw new NotFoundException(`Job ${dto.existingJobId} not found`);
      jobId = job.id;
    }

    const createdIds: string[] = [];
    let stepIndex = 0;

    for (const inc of dto.incidents) {
      if (!inc.title?.trim()) continue;

      const embeddingText = [
        inc.title,
        inc.problem    ? `Problema: ${inc.problem}`    : '',
        inc.cause      ? `Cauza: ${inc.cause}`          : '',
        inc.solution   ? `Solutie: ${inc.solution}`    : '',
        inc.prevention ? `Prevenire: ${inc.prevention}` : '',
        'source:document-import',
      ].filter(Boolean).join(' | ');

      const severity = (['low', 'medium', 'high'] as const).includes(inc.severity as 'low' | 'medium' | 'high')
        ? (inc.severity as 'low' | 'medium' | 'high')
        : 'medium';

      // For new jobs, create one JobStep per resolution step so the task is immediately actionable.
      // Prompt format matches parsePrompt() in the frontend (⚠ Risk / ✓ Known solution / 📋 Based on).
      if (newJobCreated) {
        const steps = (inc.resolutionSteps && inc.resolutionSteps.length > 0)
          ? inc.resolutionSteps
          : [inc.title.trim()];

        for (const stepName of steps) {
          const contextLines = [
            inc.problem  ? `⚠ Risk: ${inc.problem}`          : null,
            inc.solution ? `✓ Known solution: ${inc.solution}` : null,
            `📋 Based on: document import`,
          ].filter(Boolean).join('\n');

          await this.prisma.jobStep.create({
            data: {
              jobId,
              name: stepName.trim(),
              prompt: contextLines,
              status: 'pending',
              orderIndex: stepIndex++,
            },
          });
        }
      }

      const incident = await this.prisma.incident.create({
        data: {
          teamId,
          jobId,
          reportedByUserId: userId,
          title: inc.title.trim(),
          description: [inc.problem, inc.cause].filter(Boolean).join(' — ') || inc.title.trim(),
          problem:    inc.problem    ?? null,
          cause:      inc.cause      ?? null,
          solution:   inc.solution   ?? null,
          prevention: inc.prevention ?? null,
          severity,
          embeddingText,
        },
      });

      try {
        const embResponse = await this.openai.embeddings.create({
          model: this.embeddingModel,
          input: embeddingText,
        });
        const vector = embResponse.data[0]?.embedding;
        if (vector) {
          await this.pgPool.query(
            `INSERT INTO "${this.pgSchema}"."IncidentEmbedding"
               (id, "incidentId", "teamId", model, embedding, "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4::vector, NOW(), NOW())`,
            [incident.id, teamId, this.embeddingModel, `[${vector.join(',')}]`],
          );
        }
      } catch {
        // embedding failure is non-fatal — incident is saved, just not vectorised yet
      }

      createdIds.push(incident.id);
    }

    return { jobId, newJobCreated, incidentCount: createdIds.length };
  }
}
