import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MetricsService {
  constructor(private prisma: PrismaService) {}

  async getTeamMetrics(teamId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      incidentsThisMonth,
      totalEmbedded,
      totalCases,
      totalCasesWithIncidents,
      openCasesWithoutDocs,
      resolvedJobs,
    ] = await Promise.all([
      this.prisma.incident.count({
        where: { teamId, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.incidentEmbedding.count({ where: { teamId } }),
      this.prisma.job.count({ where: { teamId } }),
      // Cases that have at least one incident = AI-assisted
      this.prisma.job.count({
        where: { teamId, incidents: { some: {} } },
      }),
      // Active cases (open / in_progress) with zero incident reports — the adoption gap
      this.prisma.job.count({
        where: {
          teamId,
          status: { in: ['open', 'in_progress', 'pending'] },
          incidents: { none: {} },
        },
      }),
      this.prisma.job.findMany({
        where: { teamId, status: 'resolved' },
        select: {
          createdAt: true,
          updatedAt: true,
          incidents: { select: { id: true } },
        },
      }),
    ]);

    // Resolution time split: documented vs undocumented
    const withDocs = resolvedJobs.filter((j) => j.incidents.length > 0);
    const withoutDocs = resolvedJobs.filter((j) => j.incidents.length === 0);

    const avgDays = (jobs: { createdAt: Date; updatedAt: Date }[]) => {
      if (jobs.length === 0) return null;
      const total = jobs.reduce(
        (sum, j) => sum + (j.updatedAt.getTime() - j.createdAt.getTime()),
        0,
      );
      return Math.round((total / jobs.length / (1000 * 60 * 60 * 24)) * 10) / 10;
    };

    const adoptionRate =
      totalCases > 0 ? Math.round((totalCasesWithIncidents / totalCases) * 100) : 0;

    return {
      incidentsThisMonth,
      totalEmbedded,
      totalCases,
      totalCasesWithIncidents,
      openCasesWithoutDocs,
      adoptionRate,
      resolvedCases: resolvedJobs.length,
      avgResolutionDaysWithDocs: avgDays(withDocs),
      avgResolutionDaysWithoutDocs: avgDays(withoutDocs),
      casesWithDocs: withDocs.length,
      casesWithoutDocs: withoutDocs.length,
    };
  }
}
