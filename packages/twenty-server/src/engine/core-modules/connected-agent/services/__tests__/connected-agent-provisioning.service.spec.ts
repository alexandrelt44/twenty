import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { ConnectedAgentProvisioningService } from 'src/engine/core-modules/connected-agent/services/connected-agent-provisioning.service';

describe('ConnectedAgentProvisioningService', () => {
  let service: ConnectedAgentProvisioningService;
  let apiKeyService: jest.Mocked<ApiKeyService>;
  let repository: jest.Mocked<Repository<ConnectedAgentEntity>>;

  const expiresAt = new Date('2027-01-01T00:00:00.000Z');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectedAgentProvisioningService,
        {
          provide: ApiKeyService,
          useValue: {
            create: jest.fn(),
            generateApiKeyToken: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ConnectedAgentEntity),
          useValue: { save: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ConnectedAgentProvisioningService);
    apiKeyService = module.get(ApiKeyService);
    repository = module.get(getRepositoryToken(ConnectedAgentEntity));
  });

  it('should create an api key with the role, persist the agent and return the token once', async () => {
    apiKeyService.create.mockResolvedValue({ id: 'key-1' } as never);
    apiKeyService.generateApiKeyToken.mockResolvedValue({ token: 'jwt-token' });
    repository.save.mockImplementation(
      async (agent) => ({ id: 'agent-1', ...agent }) as never,
    );

    const result = await service.provisionConnectedAgent({
      name: 'ProofBot',
      description: 'my agent',
      roleId: 'role-1',
      workspaceId: 'ws-1',
      expiresAt,
    });

    expect(apiKeyService.create).toHaveBeenCalledWith({
      name: 'ProofBot',
      expiresAt,
      workspaceId: 'ws-1',
      roleId: 'role-1',
    });
    expect(apiKeyService.generateApiKeyToken).toHaveBeenCalledWith(
      'ws-1',
      'key-1',
      expiresAt,
    );
    expect(repository.save).toHaveBeenCalledWith({
      name: 'ProofBot',
      description: 'my agent',
      apiKeyId: 'key-1',
      workspaceId: 'ws-1',
    });
    expect(result.token).toBe('jwt-token');
    expect(result.connectedAgent.id).toBe('agent-1');
  });

  it('should throw when the token could not be generated', async () => {
    apiKeyService.create.mockResolvedValue({ id: 'key-1' } as never);
    apiKeyService.generateApiKeyToken.mockResolvedValue(undefined);

    await expect(
      service.provisionConnectedAgent({
        name: 'ProofBot',
        description: null,
        roleId: 'role-1',
        workspaceId: 'ws-1',
        expiresAt,
      }),
    ).rejects.toThrow('Failed to generate token for connected agent');
  });
});
