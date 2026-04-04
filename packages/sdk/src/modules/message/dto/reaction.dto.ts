import { IsString, IsNotEmpty } from 'class-validator';

export class AddReactionDto {
  @IsString()
  @IsNotEmpty()
  key: string;
}
