import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { FilterJobsDto } from './dto/filter-jobs.dto';
import { CompleteStepDto } from './dto/complete-step.dto';
import { JwtGuard } from '../auth/guards/auth.guards';

@UseGuards(JwtGuard)
@Controller('teams/:teamId/service-cases')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  findAll(@Param('teamId') teamId: string, @Query() filters: FilterJobsDto) {
    return this.jobsService.findAll(teamId, filters);
  }

  @Get(':id')
  findOne(@Param('teamId') teamId: string, @Param('id') id: string) {
    return this.jobsService.findOne(id, teamId);
  }

  @Post(':jobId/steps/:stepId/complete')
  completeStep(
    @Param('teamId') teamId: string,
    @Param('jobId') jobId: string,
    @Param('stepId') stepId: string,
    @Req() req: { user: { id: string } },
    @Body() dto: CompleteStepDto,
  ) {
    return this.jobsService.completeStep(teamId, jobId, stepId, req.user.id, dto);
  }

}
