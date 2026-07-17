import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { IsNull, Repository } from 'typeorm';

import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { ConnectedAgentStatus } from 'src/engine/core-modules/connected-agent/enums/connected-agent-status.enum';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';

describe('ConnectedAgentService', () => {
  let service: ConnectedAgentService;
  let repository: jest.Mocked<Repository<ConnectedAgentEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectedAgentService,
        {
          provide: getRepositoryToken(ConnectedAgentEntity),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ConnectedAgentService);
    repository = module.get(getRepositoryToken(ConnectedAgentEntity));
  });

  it('should find an active agent scoped by apiKeyId and workspaceId', async () => {
    const agent = { id: 'agent-1', name: 'ProofBot' } as ConnectedAgentEntity;

    repository.findOne.mockResolvedValue(agent);

    const result = await service.findActiveByApiKeyId('key-1', 'ws-1');

    expect(result).toBe(agent);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: {
        apiKeyId: 'key-1',
        workspaceId: 'ws-1',
        status: ConnectedAgentStatus.ACTIVE,
        deletedAt: IsNull(),
      },
    });
  });

  it('should return null when no agent matches the api key', async () => {
    repository.findOne.mockResolvedValue(null);

    const result = await service.findActiveByApiKeyId('key-unknown', 'ws-1');

    expect(result).toBeNull();
  });
});
