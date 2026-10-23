import { IsString, IsNotEmpty, IsOptional, IsInt, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLessonDto {
  @ApiProperty({ example: 'Aula 1 — Introdução' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  order: number;

  @ApiProperty({ example: 60, description: 'Duração em minutos', required: false })
  @IsOptional()
  @IsInt()
  duration?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  date?: string;
}
