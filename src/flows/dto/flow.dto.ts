import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateFlowDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  nodes: unknown[];

  @IsArray()
  edges: unknown[];
}

export class UpdateFlowDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  nodes?: unknown[];

  @IsOptional()
  @IsArray()
  edges?: unknown[];
}
