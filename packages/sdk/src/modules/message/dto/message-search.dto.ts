import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageSearchDto {
  @ApiProperty({
    description: 'Search keyword to match against message content',
    example: 'meeting',
  })
  @IsString()
  @IsNotEmpty()
  keyword!: string;

  @ApiPropertyOptional({
    description: 'Restrict search to a specific channel',
    example: 'ch_abc123',
  })
  @IsString()
  @IsOptional()
  channelId?: string;

  @ApiPropertyOptional({ description: 'Maximum number of results to return (1-100)', example: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort order for search results',
    example: 'timestamp',
    enum: ['score', 'timestamp'],
  })
  @IsIn(['score', 'timestamp'])
  @IsOptional()
  order?: 'score' | 'timestamp' = 'timestamp';

  @ApiPropertyOptional({ description: 'Whether to require an exact keyword match', example: false })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  exactMatch?: boolean = false;

  @ApiPropertyOptional({
    description: 'Filter messages created after this ISO 8601 timestamp',
    example: '2026-01-01T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  timestampFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter messages created before this ISO 8601 timestamp',
    example: '2026-12-31T23:59:59Z',
  })
  @IsDateString()
  @IsOptional()
  timestampTo?: string;
}
