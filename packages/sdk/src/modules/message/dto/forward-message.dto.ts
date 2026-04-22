import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForwardMessageDto {
  @ApiProperty({
    description: 'ID of the channel to forward the message to',
    example: 'ch_target456',
  })
  @IsString()
  @IsNotEmpty()
  targetChannelId: string;
}
