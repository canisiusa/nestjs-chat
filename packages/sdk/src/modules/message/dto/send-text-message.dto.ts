import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CHAT_DEFAULTS } from '../../../core/constants';

export class SendTextMessageDto {
  @ApiProperty({ description: 'Text content of the message', example: 'Hello, how are you?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(CHAT_DEFAULTS.MAX_MESSAGE_LENGTH)
  text: string;

  @ApiPropertyOptional({ description: 'List of user IDs mentioned in the message', example: ['user_abc123'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mentionedUserIds?: string[];

  @ApiPropertyOptional({ description: 'Parent message ID for threading (reply)', example: 'msg_parent123' })
  @IsString()
  @IsOptional()
  parentMessageId?: string;

  @ApiPropertyOptional({ description: 'Arbitrary key-value metadata attached to the message', example: { source: 'web', priority: 'normal' } })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Link preview metadata for URLs in the message', example: { url: 'https://example.com', title: 'Example', description: 'An example page', imageUrl: 'https://example.com/og.png', siteName: 'Example' } })
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
