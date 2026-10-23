import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddVolunteerDto {
  @ApiProperty({ description: 'ID do membro' })
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty({ example: 'volunteer', description: 'leader, coordinator, volunteer' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ example: 'Guitarrista', required: false })
  @IsOptional()
  @IsString()
  function?: string;
}

export class UpdateVolunteerDto {
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() function?: string;
  @IsOptional() active?: boolean;
}
