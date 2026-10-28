import { Body, Controller, Post, Param, Req, UseGuards } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { ParseDocumentDto } from './dto/parse-document.dto';
import { ConfirmImportDto } from './dto/confirm-import.dto';
import { JwtGuard } from '../auth/guards/auth.guards';

@UseGuards(JwtGuard)
@Controller('teams/:teamId')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('parse-document')
  parseDocument(
    @Param('teamId') teamId: string,
    @Body() dto: ParseDocumentDto,
  ) {
    return this.documentsService.parseDocument(teamId, dto.text);
  }

  @Post('confirm-import')
  confirmImport(
    @Param('teamId') teamId: string,
    @Req() req: { user: { id: string } },
    @Body() dto: ConfirmImportDto,
  ) {
    return this.documentsService.confirmImport(teamId, req.user.id, dto);
  }
}
