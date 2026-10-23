import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsBoolean, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum DonationType {
  TITHE = 'TITHE',
  OFFERING = 'OFFERING',
  CAMPAIGN = 'CAMPAIGN',
  SPECIAL = 'SPECIAL',
}

enum PaymentMethod {
  PIX = 'PIX',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
}

export class CreateDonationDto {
  @ApiProperty({ example: 5000, description: 'Valor em centavos (R$ 50,00 = 5000)' })
  @IsInt()
  @Min(1)
  amountCents: number;

  @ApiProperty({ enum: DonationType, default: 'OFFERING' })
  @IsEnum(DonationType)
  type: DonationType;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ required: false, description: 'ID do membro (se identificado)' })
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiProperty({ required: false, description: 'ID da campanha' })
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  donorName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  donorEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ default: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}
