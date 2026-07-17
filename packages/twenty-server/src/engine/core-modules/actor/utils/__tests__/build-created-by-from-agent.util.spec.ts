import { FieldActorSource } from 'twenty-shared/types';

import { buildCreatedByFromAgent } from 'src/engine/core-modules/actor/utils/build-created-by-from-agent.util';

describe('buildCreatedByFromAgent', () => {
  it('should stamp AGENT source with the agent name and id in context', () => {
    const result = buildCreatedByFromAgent({
      connectedAgent: {
        id: '20202020-1111-4444-8888-000000000001',
        name: 'ProofBot',
      },
    });

    expect(result).toEqual({
      source: FieldActorSource.AGENT,
      name: 'ProofBot',
      workspaceMemberId: null,
      context: { connectedAgentId: '20202020-1111-4444-8888-000000000001' },
    });
  });
});
