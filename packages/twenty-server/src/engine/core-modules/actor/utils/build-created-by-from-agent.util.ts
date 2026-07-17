import { type ActorMetadata, FieldActorSource } from 'twenty-shared/types';

import { type ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';

type BuildCreatedByFromAgentArgs = {
  connectedAgent: Pick<ConnectedAgentEntity, 'id' | 'name'>;
};

export const buildCreatedByFromAgent = ({
  connectedAgent,
}: BuildCreatedByFromAgentArgs): ActorMetadata => ({
  source: FieldActorSource.AGENT,
  name: connectedAgent.name,
  workspaceMemberId: null,
  context: { connectedAgentId: connectedAgent.id },
});
