import { registerEnumType } from '@nestjs/graphql';

export enum ConnectedAgentStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

registerEnumType(ConnectedAgentStatus, {
  name: 'ConnectedAgentStatus',
});
