import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtGuard } from '../auth/guards/auth.guards';
import { AddMemberDto, CreateTeamDto } from './dto/teams.dto';
import { TeamsService } from './teams.service';

@UseGuards(JwtGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  create(@Req() req: Request, @Body() dto: CreateTeamDto) {
    const user = req.user as { id: string };
    return this.teamsService.createTeam(user.id, dto.name);
  }

  @Get()
  getMyTeams(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.teamsService.getMyTeams(user.id);
  }

  @Get(':id')
  getTeam(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.teamsService.getTeam(user.id, id);
  }

  @Post(':id/members')
  addMember(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    const user = req.user as { id: string };
    return this.teamsService.addMember(user.id, id, dto.email);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    const user = req.user as { id: string };
    return this.teamsService.removeMember(user.id, id, targetUserId);
  }
}
