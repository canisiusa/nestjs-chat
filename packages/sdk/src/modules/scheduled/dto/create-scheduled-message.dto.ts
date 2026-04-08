import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsArray,
  IsObject,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CHAT_DEFAULTS } from '../../../core/constants';

export class CreateScheduledMessageDto {
  @ApiProperty({ description: 'Text content of the scheduled message', example: 'Reminder: standup in 5 minutes!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(CHAT_DEFAULTS.MAX_MESSAGE_LENGTH)
  text: string;

  @ApiProperty({ description: 'ISO 8601 date when the message should be sent', example: '2026-05-01T09:55:00.000Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({
    description: 'User IDs to mention in the message',
    example: ['user_abc123', 'user_def456'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mentionedUserIds?: string[];

  @ApiPropertyOptional({
    description: 'Arbitrary metadata to attach to the message',
    example: { priority: 'high', source: 'reminder' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
