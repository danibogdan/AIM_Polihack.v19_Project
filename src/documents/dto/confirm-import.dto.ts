import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class IncidentInputDto {
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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  resolutionSteps?: string[];
}

export class ConfirmImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncidentInputDto)
  incidents!: IncidentInputDto[];

  @IsIn(['new_job', 'attach_existing'])
  action!: 'new_job' | 'attach_existing';

  @IsOptional()
  @IsString()
  newJobTitle?: string;

  @IsOptional()
  @IsString()
  newJobDescription?: string;

  @IsOptional()
  @IsString()
  existingJobId?: string;
}
