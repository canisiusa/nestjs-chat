import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddReactionDto {
  @ApiProperty({ description: 'Reaction emoji key', example: 'thumbs_up' })
  @IsString()
  @IsNotEmpty()
  key: string;
}
