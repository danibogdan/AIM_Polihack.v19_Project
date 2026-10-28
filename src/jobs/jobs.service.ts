import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Pool } from 'pg';
import { PrismaService } from '../prisma/prisma.service';
import { FilterJobsDto } from './dto/filter-jobs.dto';
import { CompleteStepDto } from './dto/complete-step.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly openai: OpenAI;
  private readonly pgPool: Pool;
  private readonly pgSchema: string;
  private readonly embeddingModel: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openai = new OpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
    this.embeddingModel = config.get<string>('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';
    const dbUrl = config.getOrThrow<string>('DATABASE_URL');
    this.pgSchema = new URL(dbUrl).searchParams.get('schema') ?? 'public';
    this.pgPool = new Pool({ connectionString: dbUrl });
  }

  async onModuleDestroy() {
    await this.pgPool.end();
  }

  async findAll(teamId: string, filters: FilterJobsDto) {
    const { search, status, service, problem } = filters;

    const where: Prisma.JobWhereInput = {
      teamId,
      ...(status && { status }),
      ...(service && {
        machineType: { contains: service, mode: 'insensitive' },
      }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(problem && {
        incidents: {
          some: { problem: { contains: problem, mode: 'insensitive' } },
        },
      }),
    };

    const [jobs, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          steps: {
            orderBy: { orderIndex: 'asc' },
            select: { id: true, name: true, status: true, orderIndex: true },
          },
          incidents: {
            select: { id: true, title: true, problem: true, severity: true },
          },
          simulation: { select: { id: true, title: true } },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    return { data: jobs, total, filters: { search, status, service, problem } };
  }

  async findOne(id: string, teamId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, teamId },
      include: {
        steps: {
          orderBy: { orderIndex: 'asc' },
          include: { incidents: true },
        },
        incidents: true,
        simulation: true,
      },
    });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  async completeStep(
    teamId: string,
    jobId: string,
    stepId: string,
    userId: string,
    dto: CompleteStepDto,
  ) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, teamId } });
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    const step = await this.prisma.jobStep.findFirst({ where: { id: stepId, jobId } });
    if (!step) throw new NotFoundException(`Step ${stepId} not found`);

    await this.prisma.jobStep.update({
      where: { id: stepId },
      data: {
        status: dto.status,
        ...(dto.status === 'in_progress' ? { startedAt: new Date() } : {}),
        ...(dto.status === 'completed' || dto.status === 'failed' ? { completedAt: new Date() } : {}),
      },
    });

    if (dto.incident) {
      const { title, problem, cause, solution, prevention, severity } = dto.incident;

      const embeddingText = [
        title,
        `Pas: ${step.name}`,
        `Job: ${job.title}`,
        problem ? `Problema: ${problem}` : '',
        cause ? `Cauza: ${cause}` : '',
        solution ? `Solutie: ${solution}` : '',
        prevention ? `Prevenire: ${prevention}` : '',
        `${job.machineBrand ?? ''} ${job.machineModel ?? ''} ${job.machineType ?? ''}`.trim(),
      ].filter(Boolean).join(' | ');

      const incident = await this.prisma.incident.create({
        data: {
          teamId,
          jobId,
          jobStepId: stepId,
          reportedByUserId: userId,
          taskName: step.name,
          title,
          description: [problem, cause].filter(Boolean).join(' — ') || title,
          problem,
          cause,
          solution,
          prevention,
          severity: severity ?? 'medium',
          machineBrand: job.machineBrand,
          machineModel: job.machineModel,
          machineType: job.machineType,
          machineYear: job.machineYear,
          canonicalAction: step.name.toLowerCase().replace(/\s+/g, '_').slice(0, 50),
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
        // embedding failure is non-fatal — incident is saved, just not vectorized yet
      }

      return { ok: true, incidentId: incident.id };
    }

    return { ok: true };
  }
}
