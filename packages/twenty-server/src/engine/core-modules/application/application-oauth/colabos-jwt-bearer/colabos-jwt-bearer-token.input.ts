import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ColabosJwtBearerTokenInput {
  @IsString()
  @MaxLength(100)
  grant_type: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  assertion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  client_id?: string;
}
