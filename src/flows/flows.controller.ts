import {
  Body, Controller, Delete, Get, HttpCode,
  Param, Post,
} from '@nestjs/common';
import { FlowsService } from './flows.service';
import { CreateFlowDto, UpdateFlowDto } from './dto/flow.dto';

@Controller('flows')
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Get()
  list() {
    return this.flowsService.list();
  }

  @Get('actions')
  listActions() {
    return this.flowsService.listActions();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.flowsService.get(id);
  }

  @Post()
  create(@Body() dto: CreateFlowDto) {
    return this.flowsService.create(dto);
  }

  @Post(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFlowDto) {
    return this.flowsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.flowsService.remove(id);
  }
}
