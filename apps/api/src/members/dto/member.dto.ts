import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsEnum,
  IsEmail,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  NOT_INFORMED = 'NOT_INFORMED',
}

enum MaritalStatus {
  SINGLE = 'SINGLE',
  MARRIED = 'MARRIED',
  DIVORCED = 'DIVORCED',
  WIDOWED = 'WIDOWED',
  NOT_INFORMED = 'NOT_INFORMED',
}

export class CreateMemberDto {
  @ApiProperty({ example: 'João da Silva' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'joao@email.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '+5562982839761', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '1990-05-20', required: false })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiProperty({ enum: Gender, required: false })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ enum: MaritalStatus, required: false })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  // Address
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() complement?: string;
  @IsOptional() @IsString() neighborhood?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() zipCode?: string;

  // Church info
  @IsOptional() @IsDateString() memberSince?: string;
  @IsOptional() @IsDateString() baptismDate?: string;
  @IsOptional() @IsDateString() salvationDate?: string;
  @IsOptional() @IsBoolean() isVolunteer?: boolean;
  @IsOptional() @IsBoolean() isLeader?: boolean;
  @IsOptional() @IsString() photoUrl?: string;
}

export class UpdateMemberDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsEnum(MaritalStatus) maritalStatus?: MaritalStatus;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() complement?: string;
  @IsOptional() @IsString() neighborhood?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() zipCode?: string;
  @IsOptional() @IsDateString() memberSince?: string;
  @IsOptional() @IsDateString() baptismDate?: string;
  @IsOptional() @IsDateString() salvationDate?: string;
  @IsOptional() @IsBoolean() isVolunteer?: boolean;
  @IsOptional() @IsBoolean() isLeader?: boolean;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsString() status?: string;
}
