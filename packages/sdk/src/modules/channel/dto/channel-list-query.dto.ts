import { IsOptional, IsInt, Min, Max, IsBoolean, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ChannelListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeEmpty?: boolean = false;

  @IsOptional()
  @IsIn(['latest_last_message', 'chronological'])
  order?: 'latest_last_message' | 'chronological' = 'latest_last_message';

  @IsOptional()
  search?: string;
}
