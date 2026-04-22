import { IsArray, IsString, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteMembersDto {
  @ApiProperty({
    description: 'List of user IDs to invite to the channel',
    example: ['user_abc123', 'user_def456'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  userIds: string[];
}
