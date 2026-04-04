import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';
import { CHAT_DEFAULTS } from '../../../core/constants';

export class UpdateScheduledMessageDto {
  @IsString()
  @IsOptional()
  @MaxLength(CHAT_DEFAULTS.MAX_MESSAGE_LENGTH)
  text?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}
