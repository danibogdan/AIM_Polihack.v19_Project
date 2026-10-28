import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ProcessFlow } from '@prisma/client';
import type { CreateFlowDto, UpdateFlowDto } from './dto/flow.dto';

type FlowRow = ProcessFlow;

function toResponse(row: FlowRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    nodes: Array.isArray(row.nodesJson) ? row.nodesJson : [],
    edges: Array.isArray(row.edgesJson) ? row.edgesJson : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class FlowsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.processFlow.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toResponse);
  }

  async get(id: string) {
    const row = await this.prisma.processFlow.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Flow ${id} not found`);
    return toResponse(row);
  }

  async create(dto: CreateFlowDto) {
    const row = await this.prisma.processFlow.create({
      data: {
        title: dto.title,
        description: dto.description ?? '',
        nodesJson: (dto.nodes ?? []) as object[],
        edgesJson: (dto.edges ?? []) as object[],
      },
    });
    return toResponse(row);
  }

  async update(id: string, dto: UpdateFlowDto) {
    await this.get(id);
    const row = await this.prisma.processFlow.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.nodes !== undefined && { nodesJson: dto.nodes as object[] }),
        ...(dto.edges !== undefined && { edgesJson: dto.edges as object[] }),
      },
    });
    return toResponse(row);
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.processFlow.delete({ where: { id } });
  }

  async listActions() {
    const flows = await this.prisma.processFlow.findMany({
      select: { nodesJson: true },
    });
    const seen = new Set<string>();
    const actions: { id: string; name: string; description: string }[] = [];
    for (const flow of flows) {
      const nodes = Array.isArray(flow.nodesJson) ? flow.nodesJson : [];
      for (const node of nodes as Array<Record<string, unknown>>) {
        if (node.type !== 'action') continue;
        const data = (node.data ?? {}) as Record<string, unknown>;
        const name = typeof data.label === 'string' ? data.label.trim() : '';
        if (!name || seen.has(name)) continue;
        seen.add(name);
        actions.push({
          id: typeof node.id === 'string' ? node.id : name,
          name,
          description: typeof data.description === 'string' ? data.description : '',
        });
      }
    }
    return actions;
  }
}
