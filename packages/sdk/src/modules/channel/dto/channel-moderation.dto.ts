import { IsOptional, IsString, IsInt, Min, IsIn, IsBoolean } from 'class-validator';

export class BanUserDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  seconds?: number;
}

export class MuteUserDto {
  @IsInt()
  @Min(0)
  @IsOptional()
  seconds?: number;
}

export class SetPushTriggerDto {
  @IsIn(['all', 'mention_only', 'off'])
  option: 'all' | 'mention_only' | 'off';
}

export class SetCountPreferenceDto {
  @IsIn(['all', 'unread_message_count_only', 'off'])
  preference: 'all' | 'unread_message_count_only' | 'off';
}

export class HideChannelDto {
  @IsBoolean()
  @IsOptional()
  hidePreviousMessages?: boolean = false;
}

export class ChannelMetadataDto {
  metadata: Record<string, string>;
}

export class ReportDto {
  @IsIn(['spam', 'harassment', 'inappropriate', 'other'])
  category: string;

  @IsString()
  @IsOptional()
  description?: string;
}
