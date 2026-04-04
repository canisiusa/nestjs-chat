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

export class MessageSearchDto {
  @IsString()
  @IsNotEmpty()
  keyword: string;

  @IsString()
  @IsOptional()
  channelId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(['score', 'timestamp'])
  order?: 'score' | 'timestamp' = 'timestamp';

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  exactMatch?: boolean = false;

  @IsOptional()
  @IsDateString()
  timestampFrom?: string;

  @IsOptional()
  @IsDateString()
  timestampTo?: string;
}
