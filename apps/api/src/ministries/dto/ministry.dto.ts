import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMinistryDto {
  @ApiProperty({ example: 'Louvor' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Ministério de louvor e adoração', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '#8b5cf6', required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ example: 'music', required: false })
  @IsOptional()
  @IsString()
  iconName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  leaderId?: string;
}

export class UpdateMinistryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() iconName?: string;
  @IsOptional() @IsString() leaderId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
