import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckInDto {
  @ApiProperty({ description: 'ID da criança' })
  @IsString()
  @IsNotEmpty()
  childId: string;

  @ApiProperty({ example: 'Sala 3 - Pré-escola', required: false })
  @IsOptional()
  @IsString()
  room?: string;

  @ApiProperty({ example: 'Trouxe lanche próprio', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CheckOutDto {
  @ApiProperty({ description: 'Código de segurança gerado no check-in' })
  @IsString()
  @IsNotEmpty()
  securityCode: string;

  @ApiProperty({ description: 'Nome de quem está retirando' })
  @IsString()
  @IsNotEmpty()
  checkedOutBy: string;
}
