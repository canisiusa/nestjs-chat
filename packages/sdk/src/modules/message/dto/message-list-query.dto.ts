import { IsOptional, IsInt, Min, Max, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class MessageListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;

  @IsOptional()
  @IsDateString()
  before?: string;

  @IsOptional()
  @IsDateString()
  after?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeReactions?: boolean = true;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeThreadInfo?: boolean = true;
}
