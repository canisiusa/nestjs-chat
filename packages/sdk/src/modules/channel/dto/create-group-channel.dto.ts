import { IsArray, IsString, IsOptional, ArrayMinSize } from 'class-validator';

export class CreateGroupChannelDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  userIds: string[];

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  coverUrl?: string;
}
