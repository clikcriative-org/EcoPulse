import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddGroupMemberDto {
  @ApiProperty({ description: 'ID do membro' })
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty({ example: 'member', description: 'leader, host, member' })
  @IsOptional()
  @IsString()
  role?: string;
}
