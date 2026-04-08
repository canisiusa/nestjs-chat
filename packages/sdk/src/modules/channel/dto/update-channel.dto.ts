import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateChannelDto {
  @ApiPropertyOptional({ description: 'New display name for the channel', example: 'Renamed Team Channel' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'New cover image URL for the channel', example: 'https://cdn.example.com/covers/new.png' })
  @IsString()
  @IsOptional()
  coverUrl?: string;

  @ApiPropertyOptional({ description: 'Custom type tag for the channel', example: 'support' })
  @IsString()
  @IsOptional()
  customType?: string;
}
