import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ChannelListQueryDto {
  @ApiPropertyOptional({ description: 'Maximum number of channels to return (1-100)', example: 20 })
  @IsOptional()
  limit?: string | number = '20';

  @ApiPropertyOptional({
    description: 'Whether to include channels with no messages',
    example: false,
  })
  @IsOptional()
  includeEmpty?: string | boolean = 'false';

  @ApiPropertyOptional({
    description: 'Sort order for the channel list',
    example: 'latest_last_message',
    enum: ['latest_last_message', 'chronological'],
  })
  @IsOptional()
  @IsIn(['latest_last_message', 'chronological'])
  order?: 'latest_last_message' | 'chronological' = 'latest_last_message';

  @ApiPropertyOptional({
    description: 'Search query to filter channels by name',
    example: 'project',
  })
  @IsOptional()
  search?: string;
}
