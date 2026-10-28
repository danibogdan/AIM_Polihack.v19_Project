import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/auth.guards';
import { MetricsService } from './metrics.service';

@UseGuards(JwtGuard)
@Controller('teams/:teamId/metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  getTeamMetrics(@Param('teamId') teamId: string) {
    return this.metricsService.getTeamMetrics(teamId);
  }
}
