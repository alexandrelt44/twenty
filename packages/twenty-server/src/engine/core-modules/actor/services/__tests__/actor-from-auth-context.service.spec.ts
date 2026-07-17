import { Test, type TestingModule } from '@nestjs/testing';

import { FieldActorSource } from 'twenty-shared/types';

import { ActorFromAuthContextService } from 'src/engine/core-modules/actor/services/actor-from-auth-context.service';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';
import { type ApiKeyWorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';

describe('ActorFromAuthContextService', () => {
  let service: ActorFromAuthContextService;
  let connectedAgentService: jest.Mocked<ConnectedAgentService>;

  const apiKeyAuthContext = {
    type: 'apiKey',
    workspace: { id: 'ws-1' },
    apiKey: { id: 'key-1', name: 'Raw API Key' },
  } as unknown as ApiKeyWorkspaceAuthContext;

  const buildActorMetadata = (authContext: ApiKeyWorkspaceAuthContext) =>
    (
      service as unknown as {
        buildActorMetadata: (
          ctx: ApiKeyWorkspaceAuthContext,
        ) => Promise<{ source: string; name: string; context: unknown }>;
      }
    ).buildActorMetadata(authContext);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActorFromAuthContextService,
        {
          provide: WorkspaceManyOrAllFlatEntityMapsCacheService,
          useValue: { getOrRecomputeManyOrAllFlatEntityMaps: jest.fn() },
        },
        {
          provide: ConnectedAgentService,
          useValue: { findActiveByApiKeyId: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ActorFromAuthContextService);
    connectedAgentService = module.get(ConnectedAgentService);
  });

  it('should stamp AGENT source when the api key belongs to a connected agent', async () => {
    connectedAgentService.findActiveByApiKeyId.mockResolvedValue({
      id: 'agent-1',
      name: 'ProofBot',
    } as never);

    const result = await buildActorMetadata(apiKeyAuthContext);

    expect(connectedAgentService.findActiveByApiKeyId).toHaveBeenCalledWith(
      'key-1',
      'ws-1',
    );
    expect(result).toEqual({
      source: FieldActorSource.AGENT,
      name: 'ProofBot',
      workspaceMemberId: null,
      context: { connectedAgentId: 'agent-1' },
    });
  });

  it('should fall back to API source when the api key is not a connected agent', async () => {
    connectedAgentService.findActiveByApiKeyId.mockResolvedValue(null);

    const result = await buildActorMetadata(apiKeyAuthContext);

    expect(result).toEqual({
      source: FieldActorSource.API,
      name: 'Raw API Key',
      workspaceMemberId: null,
      context: {},
    });
  });
});
