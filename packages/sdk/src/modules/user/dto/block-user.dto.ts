import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BlockUserDto {
  @ApiProperty({ description: 'ID of the user to block or unblock', example: 'user_abc123' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
