import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'Canal: whatsapp, email, sms' })
  @IsString()
  @IsNotEmpty()
  channel: string;

  @ApiProperty({ description: 'ID do template (opcional)' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({ description: 'Destinatários (IDs de membros ou visitantes)', type: [String] })
  @IsArray()
  @IsNotEmpty()
  recipientIds: string[];

  @ApiProperty({ description: 'Tipo de destinatário: member ou visitor', default: 'member' })
  @IsOptional()
  @IsString()
  recipientType?: string;

  @ApiProperty({ description: 'Conteúdo customizado (se não usar template)', required: false })
  @IsOptional()
  content?: any;

  @ApiProperty({ description: 'Variáveis para substituir no template', required: false })
  @IsOptional()
  variables?: Record<string, string>;
}
