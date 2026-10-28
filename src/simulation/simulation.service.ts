import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Pool } from 'pg';
import { PrismaService } from '../prisma/prisma.service';
import type {
  RunSimulationDto,
  RunRagSimulationDto,
  CreateTaskFromRagDto,
} from './dto/run-simulation.dto';

export interface SimulationReview {
  riskScore: number;
  risksDetected: string[];
  recommendations: string[];
  review: string;
  suggestedProcess: Array<{ id: string; label: string; description: string }>;
}

export interface RagStepResult {
  nodeId: string;
  label: string;
  riskScore: number;
  risk: string;
  suggestion: string;
  matchedIncident: string | null;
  existingSolution: string | null;
}

export interface RagSimulationResult {
  steps: RagStepResult[];
  overallRisk: number;
  summary: string;
}

type RetrievedIncident = {
  incidentId: string;
  title: string;
  description: string;
  solution: string | null;
  severity: string | null;
  similarity: number;
};

const MOCK_INCIDENTS = `
Past incident #1 (resolved): Elevator door reversal — Otis Gen2, building A14. Root cause: photo-eye misaligned 3 mm after HVAC rebalance on floor 14. Fix: alignment + recalibration. Time to resolve: 45 min. No LOTO was applied; near-miss reported.

Past incident #2 (resolved): Carrier 30XA chiller low-pressure fault. Root cause: micro-leak at Schrader valve. Found during scheduled check. Fix: valve replacement + refrigerant recharge. Time: 2.5 h. No PPE incident.

Past incident #3 (resolved): Motor startup failure after power surge — capacitor blown. No LOTO documentation found. Recommendation issued: enforce LOTO for all motor work above 24 V.

Past incident #4 (ongoing): Intermittent HVAC condenser pressure anomaly, building B4. Pattern: every ~3 weeks at peak load. Root cause under investigation; suspected condenser coil fouling.`.trim();

const SYSTEM_PROMPT = `You are a process safety and reliability expert for field service operations. You receive a maintenance/diagnostic process described as an ordered sequence of steps and a set of real past incident reports. Your job is to:

1. Score overall risk from 0 (very safe) to 100 (very risky / missing critical steps).
2. Identify specific risks in the process (missing LOTO, no safety check, skipped verification, etc.).
3. Give actionable recommendations to make the process safer and more robust.
4. Write a brief 2-3 sentence prose review.
5. Suggest an improved version as an ordered list of steps.

Consider the past incidents when identifying risks — if the process is missing steps that past incidents showed were critical, call them out explicitly.

Respond with ONLY a valid JSON object, exactly this structure — no extra text:
{
  "riskScore": 45,
  "risksDetected": ["Risk 1", "Risk 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "review": "Brief prose review of the overall process.",
  "suggestedProcess": [
    { "id": "step-1", "label": "Short step label", "description": "Detailed step description" }
  ]
}`;

const RAG_SYSTEM_PROMPT = `You are a field service process safety expert. You receive a maintenance process as a list of steps. Each step may have historical incident context from the team's real incident database. Your job is to analyze each step individually and then give an overall summary.

For each step, output:
- riskScore: 0 (safe) to 100 (dangerous)
- risk: One concise sentence describing the main risk for this specific step
- suggestion: One concise sentence on how to mitigate it
- matchedIncident: The title of the most relevant historical incident, or null

Respond ONLY with valid JSON, exactly this structure:
{
  "steps": [
    {
      "nodeId": "the-node-id",
      "label": "Step label",
      "riskScore": 45,
      "risk": "What could go wrong at this step",
      "suggestion": "How to prevent it",
      "matchedIncident": "Incident title or null"
    }
  ],
  "overallRisk": 55,
  "summary": "2-3 sentence summary of the overall process risk based on the team's history."
}`;

@Injectable()
export class SimulationService implements OnModuleDestroy {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(SimulationService.name);
  private readonly pgPool: Pool;
  private readonly pgSchema: string;
  private readonly embeddingModel: string;
  private readonly chatModel: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.openai = new OpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
    });
    this.chatModel = config.get<string>('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini';
    this.embeddingModel =
      config.get<string>('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';

    const dbUrl = config.getOrThrow<string>('DATABASE_URL');
    this.pgSchema = new URL(dbUrl).searchParams.get('schema') ?? 'public';
    this.pgPool = new Pool({ connectionString: dbUrl });
  }

  async onModuleDestroy() {
    await this.pgPool.end();
  }

  // ── existing simulation ───────────────────────────────────────

  async runSimulation(dto: RunSimulationDto): Promise<SimulationReview> {
    const processText = this.describeProcess(dto);

    const incidentContext =
      dto.ragContext && dto.ragContext.length > 0
        ? dto.ragContext
            .map((s) => {
              const parts = [`Step "${s.label}"`];
              if (s.matchedIncident) parts.push(`matched incident: "${s.matchedIncident}"`);
              if (s.existingSolution) parts.push(`known solution: ${s.existingSolution}`);
              else if (s.risk) parts.push(`identified risk: ${s.risk}`);
              return `- ${parts.join(' — ')}`;
            })
            .join('\n')
        : MOCK_INCIDENTS;

    const userMessage = `PROCESS TITLE: ${dto.title}\n\nPROCESS STEPS:\n${processText}\n\nPAST INCIDENTS FOR CONTEXT:\n${incidentContext}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.chatModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 1500,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      });

      const text = completion.choices[0]?.message?.content ?? '';
      const parsed = JSON.parse(text) as SimulationReview;

      return {
        riskScore: Math.max(0, Math.min(100, Number(parsed.riskScore) || 50)),
        risksDetected: Array.isArray(parsed.risksDetected) ? parsed.risksDetected : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        review: typeof parsed.review === 'string' ? parsed.review : '',
        suggestedProcess: Array.isArray(parsed.suggestedProcess) ? parsed.suggestedProcess : [],
      };
    } catch (err) {
      this.logger.error('OpenAI simulation analysis error', err);
      return {
        riskScore: 50,
        risksDetected: ['Unable to analyze process — API error.'],
        recommendations: ['Please try again.'],
        review: 'Analysis failed due to a server error.',
        suggestedProcess: [],
      };
    }
  }

  // ── RAG simulation ────────────────────────────────────────────

  async runRagSimulation(dto: RunRagSimulationDto): Promise<RagSimulationResult> {
    const actionNodes = dto.nodes.filter(
      (n) => n.type === 'action' || n.type === 'decision',
    );

    if (actionNodes.length === 0) {
      return { steps: [], overallRisk: 0, summary: 'No action nodes found in this flow.' };
    }

    // Embed all node labels in parallel
    const embedResults = await Promise.all(
      actionNodes.map((node) =>
        this.openai.embeddings.create({
          model: this.embeddingModel,
          input: `${node.label}${node.description ? ': ' + node.description : ''}`,
        }),
      ),
    );

    // Retrieve incidents per node in parallel
    const incidentsByNode = await Promise.all(
      embedResults.map((emb, i) => {
        const vector = emb.data[0]?.embedding;
        if (!vector) return Promise.resolve([]);
        return this.retrieveIncidents({
          teamId: dto.teamId,
          queryEmbedding: vector,
          topK: 2,
        });
      }),
    );

    // Build context string for OpenAI
    const stepsContext = actionNodes
      .map((node, i) => {
        const incidents = incidentsByNode[i] ?? [];
        const incidentLines =
          incidents.length > 0
            ? incidents
                .map(
                  (inc) =>
                    `  - [${(inc.similarity * 100).toFixed(0)}% match] "${inc.title}": ${inc.description.slice(0, 120)}${inc.severity ? ` (severity: ${inc.severity})` : ''}${inc.solution ? `\n    Known solution: ${inc.solution.slice(0, 150)}` : ''}`,
                )
                .join('\n')
            : '  - No historical incidents found for this step.';

        return `Node ID: ${node.id}\nStep: ${node.label}${node.description ? `\nDescription: ${node.description}` : ''}\nHistorical context:\n${incidentLines}`;
      })
      .join('\n\n---\n\n');

    const userMessage = `Process title: "${dto.title}"\n\nSteps with historical context:\n\n${stepsContext}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.chatModel,
        messages: [
          { role: 'system', content: RAG_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 2000,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const text = completion.choices[0]?.message?.content ?? '';
      const parsed = JSON.parse(text) as RagSimulationResult;

      const solutionByIndex = incidentsByNode.map(
        (incs) => incs[0]?.solution ?? null,
      );

      return {
        steps: Array.isArray(parsed.steps)
          ? parsed.steps.map((s, i) => ({
              nodeId: typeof s.nodeId === 'string' ? s.nodeId : '',
              label: typeof s.label === 'string' ? s.label : '',
              riskScore: Math.max(0, Math.min(100, Number(s.riskScore) || 0)),
              risk: typeof s.risk === 'string' ? s.risk : '',
              suggestion: typeof s.suggestion === 'string' ? s.suggestion : '',
              matchedIncident: typeof s.matchedIncident === 'string' ? s.matchedIncident : null,
              existingSolution: solutionByIndex[i] ?? null,
            }))
          : [],
        overallRisk: Math.max(0, Math.min(100, Number(parsed.overallRisk) || 0)),
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      };
    } catch (err) {
      this.logger.error('RAG simulation error', err);
      return {
        steps: actionNodes.map((n) => ({
          nodeId: n.id,
          label: n.label,
          riskScore: 50,
          risk: 'Analysis unavailable.',
          suggestion: 'Please retry.',
          matchedIncident: null,
          existingSolution: null,
        })),
        overallRisk: 50,
        summary: 'Analysis failed due to a server error.',
      };
    }
  }

  // ── create task from RAG results ──────────────────────────────

  async createTaskFromRag(dto: CreateTaskFromRagDto): Promise<{ jobId: string }> {
    const job = await this.prisma.job.create({
      data: {
        teamId: dto.teamId,
        title: dto.title,
        description: dto.description ?? '',
        status: 'pending',
        steps: {
          create: dto.steps.map((s, i) => ({
            name: s.name,
            prompt: s.prompt ?? '',
            status: 'pending',
            orderIndex: i,
          })),
        },
      },
    });
    return { jobId: job.id };
  }

  // ── helpers ───────────────────────────────────────────────────

  private async retrieveIncidents(params: {
    teamId: string;
    queryEmbedding: number[];
    topK: number;
  }): Promise<RetrievedIncident[]> {
    const { teamId, queryEmbedding, topK } = params;
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;
    const schema = this.pgSchema;

    const client = await this.pgPool.connect();
    try {
      await client.query(`SET search_path TO "${schema}", public`);
      const result = await client.query<RetrievedIncident>(
        `SELECT
          ie."incidentId" as "incidentId",
          i."title"       as "title",
          i."description" as "description",
          i."solution"    as "solution",
          i."severity"    as "severity",
          (1 - (ie."embedding" <=> $1::vector))::float8 as "similarity"
        FROM "${schema}"."IncidentEmbedding" ie
        JOIN "${schema}"."Incident" i ON i."id" = ie."incidentId"
        WHERE ie."teamId" = $2
        ORDER BY ie."embedding" <=> $1::vector ASC
        LIMIT $3`,
        [vectorLiteral, teamId, topK],
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  private describeProcess(dto: RunSimulationDto): string {
    const nodeMap = new Map(dto.nodes.map((n) => [n.id, n]));
    const lines: string[] = [];
    const start = dto.nodes.find((n) => n.type === 'start');

    if (!start) {
      return dto.nodes
        .map((n, i) => `${i + 1}. [${n.type.toUpperCase()}] ${n.label}${n.description ? `: ${n.description}` : ''}`)
        .join('\n');
    }

    const visited = new Set<string>();
    const queue: string[] = [start.id];
    let order = 1;

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const node = nodeMap.get(currentId);
      if (!node) continue;
      lines.push(`${order}. [${node.type.toUpperCase()}] ${node.label}${node.description ? ` — ${node.description}` : ''}`);
      order++;
      for (const edge of dto.edges.filter((e) => e.source === currentId)) {
        queue.push(edge.target);
      }
    }

    for (const node of dto.nodes) {
      if (!visited.has(node.id)) {
        lines.push(`${order}. [${node.type.toUpperCase()}] ${node.label}${node.description ? ` — ${node.description}` : ''} (disconnected node)`);
        order++;
      }
    }

    return lines.join('\n');
  }
}
