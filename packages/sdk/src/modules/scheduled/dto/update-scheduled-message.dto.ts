import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CHAT_DEFAULTS } from '../../../core/constants';

export class UpdateScheduledMessageDto {
  @ApiPropertyOptional({ description: 'Updated text content', example: 'Updated reminder: standup in 10 minutes!' })
  @IsString()
  @IsOptional()
  @MaxLength(CHAT_DEFAULTS.MAX_MESSAGE_LENGTH)
  text?: string;

  @ApiPropertyOptional({ description: 'Updated ISO 8601 scheduled date', example: '2026-05-01T10:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}
