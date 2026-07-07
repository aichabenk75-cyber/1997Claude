import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PostType } from '../post.entity';

class PollInputDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  options: string[];

  @IsOptional()
  @IsDateString()
  closesAt?: string;
}

export class CreatePostDto {
  @IsEnum(PostType)
  type: PostType;

  @ValidateIf((o) => o.type !== PostType.PHOTO)
  @IsString()
  @Length(1, 5000)
  body?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  tags?: string[];

  // Clés S3 obtenues via POST /v1/me/media/upload-url (l'API ne reçoit pas les octets)
  @ValidateIf((o) => o.type === PostType.PHOTO)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  mediaKeys?: string[];

  @ValidateIf((o) => o.type === PostType.SONDAGE)
  @ValidateNested()
  @Type(() => PollInputDto)
  poll?: PollInputDto;
}

export class CreateCommentDto {
  @IsString()
  @Length(1, 2000)
  body: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class FeedQueryDto {
  @IsOptional()
  @IsEnum(['algo', 'chrono'] as const)
  mode?: 'algo' | 'chrono';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
}
