import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsBoolean,
  IsDateString,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CHAT_DEFAULTS } from '../../../core/constants';

export class CreatePollDto {
  @ApiProperty({ description: 'Title of the poll', example: 'What should we have for lunch?' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'List of poll options (min 2)',
    example: ['Pizza', 'Sushi', 'Burgers'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(CHAT_DEFAULTS.MAX_POLL_OPTIONS)
  options: string[];

  @ApiPropertyOptional({ description: 'Allow users to vote for multiple options', example: false })
  @IsBoolean()
  @IsOptional()
  allowMultipleVotes?: boolean = false;

  @ApiPropertyOptional({ description: 'Allow users to suggest new options', example: false })
  @IsBoolean()
  @IsOptional()
  allowUserSuggestion?: boolean = false;

  @ApiPropertyOptional({ description: 'ISO 8601 date when the poll closes', example: '2026-05-01T18:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  closeAt?: string;
}
