import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Pastor João' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'pastor@igreja.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senha123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Igreja Vida Nova' })
  @IsString()
  @IsNotEmpty()
  churchName: string;

  @ApiProperty({ example: '+5562982839761', required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}
