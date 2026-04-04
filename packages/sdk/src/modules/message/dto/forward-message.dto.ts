import { IsString, IsNotEmpty } from 'class-validator';

export class ForwardMessageDto {
  @IsString()
  @IsNotEmpty()
  targetChannelId: string;
}
