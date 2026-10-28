import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SimNodeDto {
  @IsString()
  id: string;

  @IsString()
  type: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class SimEdgeDto {
  @IsString()
  source: string;

  @IsString()
  target: string;
}

export class RagStepContextDto {
  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  risk?: string;

  @IsOptional()
  @IsString()
  matchedIncident?: string | null;

  @IsOptional()
  @IsString()
  existingSolution?: string | null;
}

export class RunSimulationDto {
  @IsString()
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimNodeDto)
  nodes: SimNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimEdgeDto)
  edges: SimEdgeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RagStepContextDto)
  ragContext?: RagStepContextDto[];
}

export class RunRagSimulationDto {
  @IsString()
  title: string;

  @IsString()
  teamId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimNodeDto)
  nodes: SimNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimEdgeDto)
  edges: SimEdgeDto[];
}

export class CreateTaskStepDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  prompt?: string;
}

export class CreateTaskFromRagDto {
  @IsString()
  teamId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTaskStepDto)
  steps: CreateTaskStepDto[];
}
