import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsArray,
  IsObject,
  MaxLength,
} from 'class-validator';
import { CHAT_DEFAULTS } from '../../../core/constants';

export class CreateScheduledMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(CHAT_DEFAULTS.MAX_MESSAGE_LENGTH)
  text: string;

  @IsDateString()
  scheduledAt: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mentionedUserIds?: string[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
