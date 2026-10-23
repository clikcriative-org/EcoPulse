import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Boas-vindas' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'whatsapp', description: 'whatsapp, email, sms' })
  @IsString()
  @IsNotEmpty()
  channel: string;

  @ApiProperty({ example: { body: 'Olá {{nome}}, seja bem-vindo!' } })
  @IsNotEmpty()
  content: any;

  @ApiProperty({ example: ['nome', 'igreja'], required: false })
  @IsOptional()
  @IsArray()
  variables?: string[];
}

export class UpdateTemplateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() content?: any;
  @IsOptional() @IsArray() variables?: string[];
  @IsOptional() active?: boolean;
}
