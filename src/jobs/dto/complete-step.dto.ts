import { IsIn, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class IncidentDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  problem?: string;

  @IsOptional()
  @IsString()
  cause?: string;

  @IsOptional()
  @IsString()
  solution?: string;

  @IsOptional()
  @IsString()
  prevention?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  severity?: string;
}

export class CompleteStepDto {
  @IsIn(['completed', 'failed', 'in_progress'])
  status!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => IncidentDto)
  incident?: IncidentDto;
}
