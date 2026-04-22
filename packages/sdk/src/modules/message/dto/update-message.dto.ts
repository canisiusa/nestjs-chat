import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CHAT_DEFAULTS } from '../../../core/constants';

export class UpdateMessageDto {
  @ApiProperty({
    description: 'Updated text content of the message',
    example: 'Hello, updated message!',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(CHAT_DEFAULTS.MAX_MESSAGE_LENGTH)
  text: string;
}
