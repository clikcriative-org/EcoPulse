import { IsString, IsNotEmpty, IsOptional, IsInt, IsDateString, IsBoolean, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Construção do Templo' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 10000000, description: 'Meta em centavos', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  goalCents?: number;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  startAt: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endAt?: string;
}

export class UpdateCampaignDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(1) goalCents?: number;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
