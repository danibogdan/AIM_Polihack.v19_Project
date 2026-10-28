import { Body, Controller, Post } from '@nestjs/common';
import { SimulationService } from './simulation.service';
import {
  RunSimulationDto,
  RunRagSimulationDto,
  CreateTaskFromRagDto,
} from './dto/run-simulation.dto';

@Controller('simulation')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post('run')
  run(@Body() dto: RunSimulationDto) {
    return this.simulationService.runSimulation(dto);
  }

  @Post('run-rag')
  runRag(@Body() dto: RunRagSimulationDto) {
    return this.simulationService.runRagSimulation(dto);
  }

  @Post('create-task')
  createTask(@Body() dto: CreateTaskFromRagDto) {
    return this.simulationService.createTaskFromRag(dto);
  }
}
