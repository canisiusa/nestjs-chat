import { IsString, IsNotEmpty } from 'class-validator';

export class CreateDirectChannelDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
