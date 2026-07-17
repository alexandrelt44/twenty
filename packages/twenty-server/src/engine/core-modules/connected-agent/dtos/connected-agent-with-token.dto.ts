import { Field, ObjectType } from '@nestjs/graphql';

import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';

@ObjectType('ConnectedAgentWithToken')
export class ConnectedAgentWithTokenDTO {
  @Field(() => ConnectedAgentEntity)
  connectedAgent: ConnectedAgentEntity;

  @Field(() => String, {
    description: 'Only returned once, at creation time. Store it securely.',
  })
  token: string;
}
