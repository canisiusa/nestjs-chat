import { IsOptional, IsString, IsInt, Min, IsIn, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BanUserDto {
  @ApiPropertyOptional({ description: 'Reason for banning the user', example: 'Repeated spam messages' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Ban duration in seconds (0 for permanent)', example: 3600 })
  @IsInt()
  @Min(0)
  @IsOptional()
  seconds?: number;
}

export class MuteUserDto {
  @ApiPropertyOptional({ description: 'Mute duration in seconds (0 for indefinite)', example: 600 })
  @IsInt()
  @Min(0)
  @IsOptional()
  seconds?: number;
}

export class SetPushTriggerDto {
  @ApiProperty({ description: 'Push notification trigger option', example: 'mention_only', enum: ['all', 'mention_only', 'off'] })
  @IsIn(['all', 'mention_only', 'off'])
  option: 'all' | 'mention_only' | 'off';
}

export class SetCountPreferenceDto {
  @ApiProperty({ description: 'Unread count preference', example: 'all', enum: ['all', 'unread_message_count_only', 'off'] })
  @IsIn(['all', 'unread_message_count_only', 'off'])
  preference: 'all' | 'unread_message_count_only' | 'off';
}

export class HideChannelDto {
  @ApiPropertyOptional({ description: 'Whether to also hide previous messages when hiding the channel', example: false })
  @IsBoolean()
  @IsOptional()
  hidePreviousMessages?: boolean = false;
}

export class ChannelMetadataDto {
  @ApiProperty({ description: 'Key-value metadata to attach to the channel', example: { theme: 'dark', priority: 'high' } })
  metadata: Record<string, string>;
}

export class ReportDto {
  @ApiProperty({ description: 'Report category', example: 'spam', enum: ['spam', 'harassment', 'inappropriate', 'other'] })
  @IsIn(['spam', 'harassment', 'inappropriate', 'other'])
  category: string;

  @ApiPropertyOptional({ description: 'Detailed description of the report', example: 'User is sending repeated unsolicited messages' })
  @IsString()
  @IsOptional()
  description?: string;
}
