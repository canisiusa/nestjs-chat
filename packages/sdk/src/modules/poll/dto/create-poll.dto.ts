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
import { CHAT_DEFAULTS } from '../../../core/constants';

export class CreatePollDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(CHAT_DEFAULTS.MAX_POLL_OPTIONS)
  options: string[];

  @IsBoolean()
  @IsOptional()
  allowMultipleVotes?: boolean = false;

  @IsBoolean()
  @IsOptional()
  allowUserSuggestion?: boolean = false;

  @IsDateString()
  @IsOptional()
  closeAt?: string;
}
