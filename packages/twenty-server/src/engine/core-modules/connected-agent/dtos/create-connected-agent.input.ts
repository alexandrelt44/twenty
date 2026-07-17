import { Field, InputType } from '@nestjs/graphql';

import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@InputType()
export class CreateConnectedAgentInput {
  @Field(() => String)
  @IsString()
  name: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field(() => UUIDScalarType)
  @IsUUID()
  roleId: string;

  @Field(() => String)
  @IsDateString()
  expiresAt: string;
}
