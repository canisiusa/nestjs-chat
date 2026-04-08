import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchUsersDto {
  @ApiProperty({ description: 'Search keyword to match against user names', example: 'john' })
  @IsString()
  @IsNotEmpty()
  keyword!: string;

  @ApiPropertyOptional({ description: 'Maximum number of results to return (1-50)', example: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 20;
}
