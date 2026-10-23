import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  NOT_INFORMED = 'NOT_INFORMED',
}

export class CreateChildDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '2020-03-15', required: false })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiProperty({ enum: Gender, required: false })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ example: 'Alergia a amendoim', required: false })
  @IsOptional()
  @IsString()
  allergies?: string;

  @ApiProperty({ example: 'Usa inalador para asma', required: false })
  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @ApiProperty({ example: 'João Silva' })
  @IsString()
  @IsNotEmpty()
  parentName: string;

  @ApiProperty({ example: '+5562982839761' })
  @IsString()
  @IsNotEmpty()
  parentPhone: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentMemberId?: string;

  @ApiProperty({ example: 'preschool', required: false })
  @IsOptional()
  @IsString()
  ageGroup?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  photoUrl?: string;
}

export class UpdateChildDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @IsOptional()
  @IsString()
  parentName?: string;

  @IsOptional()
  @IsString()
  parentPhone?: string;

  @IsOptional()
  @IsString()
  parentMemberId?: string;

  @IsOptional()
  @IsString()
  ageGroup?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
