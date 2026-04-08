import { IsOptional, IsInt, Min, Max, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MessageListQueryDto {
  @ApiPropertyOptional({ description: 'Maximum number of messages to return (1-100)', example: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 30;

  @ApiPropertyOptional({ description: 'Fetch messages created before this ISO 8601 timestamp', example: '2026-01-15T10:30:00Z' })
  @IsDateString()
  @IsOptional()
  before?: string;

  @ApiPropertyOptional({ description: 'Fetch messages created after this ISO 8601 timestamp', example: '2026-01-15T08:00:00Z' })
  @IsDateString()
  @IsOptional()
  after?: string;

  @ApiPropertyOptional({ description: 'Whether to include reaction data with each message', example: true })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  includeReactions?: boolean = true;

  @ApiPropertyOptional({ description: 'Whether to include thread info with each message', example: true })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  includeThreadInfo?: boolean = true;
}
