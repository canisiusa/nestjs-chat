import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class VotePollDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  optionIds: string[];
}
