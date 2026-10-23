import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum GroupType {
  CELL = 'CELL',
  DISCIPLESHIP = 'DISCIPLESHIP',
  MINISTRY_GROUP = 'MINISTRY_GROUP',
  COURSE_GROUP = 'COURSE_GROUP',
}

export class CreateGroupDto {
  @ApiProperty({ example: 'Célula Vida Nova' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: GroupType, default: 'CELL' })
  @IsOptional()
  @IsEnum(GroupType)
  type?: GroupType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  leaderId?: string;

  @ApiProperty({ example: 'Quarta-feira', required: false })
  @IsOptional()
  @IsString()
  meetingDay?: string;

  @ApiProperty({ example: '19:30', required: false })
  @IsOptional()
  @IsString()
  meetingTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  maxMembers?: number;
}

export class UpdateGroupDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(GroupType) type?: GroupType;
  @IsOptional() @IsString() leaderId?: string;
  @IsOptional() @IsString() meetingDay?: string;
  @IsOptional() @IsString() meetingTime?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsInt() maxMembers?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
