import { IsString, IsOptional, IsObject } from 'class-validator';

export class UpdateChannelDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  coverUrl?: string;

  @IsString()
  @IsOptional()
  customType?: string;
}
