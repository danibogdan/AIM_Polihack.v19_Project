import { IsString } from 'class-validator';

export class ParseDocumentDto {
  @IsString()
  text!: string;
}
