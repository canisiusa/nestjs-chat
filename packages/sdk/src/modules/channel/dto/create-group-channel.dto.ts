import { IsArray, IsString, IsOptional, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupChannelDto {
  @ApiProperty({ description: 'List of user IDs to add to the group channel', example: ['user_abc123', 'user_def456'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  userIds: string[];

  @ApiPropertyOptional({ description: 'Display name of the group channel', example: 'Project Team' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'URL of the channel cover image', example: 'https://cdn.example.com/covers/team.png' })
  @IsString()
  @IsOptional()
  coverUrl?: string;
}
