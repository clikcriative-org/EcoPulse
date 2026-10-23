import { IsString, IsNotEmpty, IsOptional, IsInt, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCourseDto {
  @ApiProperty({ example: 'Escola de Líderes' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Liderança', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 'presential', description: 'presential, online, hybrid' })
  @IsOptional()
  @IsString()
  mode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  maxStudents?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endAt?: string;
}

export class UpdateCourseDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() mode?: string;
  @IsOptional() @IsInt() maxStudents?: number;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() active?: boolean;
}
