import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTeam(userId: string, name: string) {
    const company = await this.prisma.company.create({
      data: { name },
    });

    const team = await this.prisma.team.create({
      data: {
        name,
        companyId: company.id,
        members: {
          create: { userId, role: 'admin' },
        },
      },
      include: { members: { include: { user: { select: { id: true, email: true, name: true } } } } },
    });

    return team;
  }

  async getMyTeams(userId: string) {
    return this.prisma.team.findMany({
      where: { members: { some: { userId } } },
      include: {
        _count: { select: { members: true } },
        members: {
          where: { userId },
          select: { role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTeam(userId: string, teamId: string) {
    await this.assertMember(userId, teamId);

    return this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true, displayName: true } } },
          orderBy: { role: 'asc' },
        },
      },
    });
  }

  async addMember(actorId: string, teamId: string, email: string) {
    await this.assertMember(actorId, teamId);

    const targetUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!targetUser) {
      throw new NotFoundException(`Niciun utilizator cu email-ul ${email}`);
    }

    const existing = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: targetUser.id, teamId } },
    });

    if (existing) {
      throw new ConflictException('Utilizatorul este deja membru al echipei');
    }

    await this.prisma.teamMember.create({
      data: { userId: targetUser.id, teamId, role: 'member' },
    });

    return { message: `${email} a fost adăugat în echipă` };
  }

  async removeMember(actorId: string, teamId: string, targetUserId: string) {
    await this.assertMember(actorId, teamId);

    if (actorId === targetUserId) {
      throw new ForbiddenException('Nu te poți elimina singur din echipă');
    }

    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: targetUserId, teamId } },
    });

    if (!membership) {
      throw new NotFoundException('Membrul nu a fost găsit în echipă');
    }

    await this.prisma.teamMember.delete({
      where: { userId_teamId: { userId: targetUserId, teamId } },
    });

    return { message: 'Membrul a fost eliminat din echipă' };
  }

  private async assertMember(userId: string, teamId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });

    if (!membership) {
      throw new ForbiddenException('Nu ești membru al acestei echipe');
    }
  }
}
