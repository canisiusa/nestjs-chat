import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject, MaxLength } from 'class-validator';
import { CHAT_DEFAULTS } from '../../../core/constants';

export class SendTextMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(CHAT_DEFAULTS.MAX_MESSAGE_LENGTH)
  text: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mentionedUserIds?: string[];

  @IsString()
  @IsOptional()
  parentMessageId?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsObject()
  @IsOptional()
  linkMetadata?: {
    url: string;
    title?: string;
    description?: string;
    imageUrl?: string;
    siteName?: string;
  };
}
