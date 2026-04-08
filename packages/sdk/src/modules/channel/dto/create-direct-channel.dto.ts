import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDirectChannelDto {
  @ApiProperty({ description: 'ID of the user to start a direct channel with', example: 'user_abc123' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
