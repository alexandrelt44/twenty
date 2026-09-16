import { Test, type TestingModule } from '@nestjs/testing';

import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { ConnectedAgentProvisioningService } from 'src/engine/core-modules/connected-agent/services/connected-agent-provisioning.service';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';
import { getWorkspaceScopedRepositoryToken } from 'src/engine/twenty-orm/workspace-scoped-repository/get-workspace-scoped-repository-token.util';
import { type WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

describe('ConnectedAgentProvisioningService', () => {
  let service: ConnectedAgentProvisioningService;
  let apiKeyService: jest.Mocked<ApiKeyService>;
  let connectedAgentService: jest.Mocked<ConnectedAgentService>;
  let repository: jest.Mocked<WorkspaceScopedRepository<ConnectedAgentEntity>>;

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
            revoke: jest.fn(),
          },
        },
        {
          provide: ConnectedAgentService,
          useValue: {
            findById: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: getWorkspaceScopedRepositoryToken(ConnectedAgentEntity),
          useValue: { insertAndReturnOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ConnectedAgentProvisioningService);
    apiKeyService = module.get(ApiKeyService);
    connectedAgentService = module.get(ConnectedAgentService);
    repository = module.get(
      getWorkspaceScopedRepositoryToken(ConnectedAgentEntity),
    );
  });

  it('should create an api key with the role, persist the agent and return the token once', async () => {
    apiKeyService.create.mockResolvedValue({ id: 'key-1' } as never);
    apiKeyService.generateApiKeyToken.mockResolvedValue({ token: 'jwt-token' });
    repository.insertAndReturnOne.mockImplementation(
      async (_workspaceId, agent) => ({ id: 'agent-1', ...agent }) as never,
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
    expect(repository.insertAndReturnOne).toHaveBeenCalledWith('ws-1', {
      name: 'ProofBot',
      description: 'my agent',
      apiKeyId: 'key-1',
    });
    expect(result.token).toBe('jwt-token');
    expect(result.connectedAgent.id).toBe('agent-1');
  });

  it('should throw when the token could not be generated', async () => {
    apiKeyService.create.mockResolvedValue({ id: 'key-1' } as never);
    apiKeyService.generateApiKeyToken.mockResolvedValue(undefined);
    apiKeyService.revoke.mockResolvedValue(null);

    await expect(
      service.provisionConnectedAgent({
        name: 'ProofBot',
        description: null,
        roleId: 'role-1',
        workspaceId: 'ws-1',
        expiresAt,
      }),
    ).rejects.toThrow('Failed to generate token for connected agent');

    expect(apiKeyService.revoke).toHaveBeenCalledWith('key-1', 'ws-1');
  });

  it('should revoke the created api key and rethrow the original error when generateApiKeyToken throws', async () => {
    apiKeyService.create.mockResolvedValue({ id: 'key-1' } as never);
    const originalError = new Error('token generation blew up');

    apiKeyService.generateApiKeyToken.mockRejectedValue(originalError);
    apiKeyService.revoke.mockResolvedValue(null);

    await expect(
      service.provisionConnectedAgent({
        name: 'ProofBot',
        description: null,
        roleId: 'role-1',
        workspaceId: 'ws-1',
        expiresAt,
      }),
    ).rejects.toThrow(originalError);

    expect(apiKeyService.revoke).toHaveBeenCalledWith('key-1', 'ws-1');
    expect(repository.insertAndReturnOne).not.toHaveBeenCalled();
  });

  it('should revoke the created api key and rethrow the original error when the connected agent save fails', async () => {
    apiKeyService.create.mockResolvedValue({ id: 'key-1' } as never);
    apiKeyService.generateApiKeyToken.mockResolvedValue({ token: 'jwt-token' });
    const originalError = new Error('save failed');

    repository.insertAndReturnOne.mockRejectedValue(originalError);
    apiKeyService.revoke.mockResolvedValue(null);

    await expect(
      service.provisionConnectedAgent({
        name: 'ProofBot',
        description: null,
        roleId: 'role-1',
        workspaceId: 'ws-1',
        expiresAt,
      }),
    ).rejects.toThrow(originalError);

    expect(apiKeyService.revoke).toHaveBeenCalledWith('key-1', 'ws-1');
  });

  it('should not mask the original error when the revoke cleanup itself fails', async () => {
    apiKeyService.create.mockResolvedValue({ id: 'key-1' } as never);
    const originalError = new Error('token generation blew up');

    apiKeyService.generateApiKeyToken.mockRejectedValue(originalError);
    apiKeyService.revoke.mockRejectedValue(new Error('revoke failed too'));

    await expect(
      service.provisionConnectedAgent({
        name: 'ProofBot',
        description: null,
        roleId: 'role-1',
        workspaceId: 'ws-1',
        expiresAt,
      }),
    ).rejects.toThrow(originalError);

    expect(apiKeyService.revoke).toHaveBeenCalledWith('key-1', 'ws-1');
  });

  describe('deleteConnectedAgent', () => {
    it('revokes the api key and soft-deletes the agent when it exists', async () => {
      const agent = {
        id: 'agent-1',
        apiKeyId: 'key-1',
      } as ConnectedAgentEntity;

      connectedAgentService.findById.mockResolvedValue(agent);
      apiKeyService.revoke.mockResolvedValue(null);
      connectedAgentService.softDelete.mockResolvedValue(undefined);

      const result = await service.deleteConnectedAgent('agent-1', 'ws-1');

      expect(connectedAgentService.findById).toHaveBeenCalledWith(
        'agent-1',
        'ws-1',
      );
      expect(apiKeyService.revoke).toHaveBeenCalledWith('key-1', 'ws-1');
      expect(connectedAgentService.softDelete).toHaveBeenCalledWith(
        'agent-1',
        'ws-1',
      );
      expect(result).toBe(true);
    });

    it('returns false and does nothing when the agent does not exist', async () => {
      connectedAgentService.findById.mockResolvedValue(null);

      const result = await service.deleteConnectedAgent('agent-1', 'ws-1');

      expect(apiKeyService.revoke).not.toHaveBeenCalled();
      expect(connectedAgentService.softDelete).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
});
