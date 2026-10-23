import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnrollDto {
  @ApiProperty({ description: 'ID do membro' })
  @IsString()
  @IsNotEmpty()
  memberId: string;
}
