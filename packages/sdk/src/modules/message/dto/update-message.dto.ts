import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { CHAT_DEFAULTS } from '../../../core/constants';

export class UpdateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(CHAT_DEFAULTS.MAX_MESSAGE_LENGTH)
  text: string;
}
