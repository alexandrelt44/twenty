import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { ConnectedAgentStatus } from 'src/engine/core-modules/connected-agent/enums/connected-agent-status.enum';

@InputType()
export class SetConnectedAgentStatusInput {
  @Field(() => UUIDScalarType)
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @Field(() => ConnectedAgentStatus)
  @IsEnum(ConnectedAgentStatus)
  status: ConnectedAgentStatus;
}
