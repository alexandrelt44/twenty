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
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
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

  describe('touchLastSeen', () => {
    it('should set lastSeenAt to now for the given agent scoped by workspace', async () => {
      const update = repository.update as jest.Mock;

      await service.touchLastSeen('agent-1', 'ws-1');

      expect(update).toHaveBeenCalledWith(
        { id: 'agent-1', workspaceId: 'ws-1' },
        { lastSeenAt: expect.any(Date) },
      );
    });
  });

  describe('findByWorkspaceId', () => {
    it('lists non-deleted agents for the workspace, newest first', async () => {
      const rows = [{ id: 'a1' }] as ConnectedAgentEntity[];

      (repository.find as jest.Mock).mockResolvedValue(rows);

      const result = await service.findByWorkspaceId('ws-1');

      expect(repository.find).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toBe(rows);
    });
  });

  describe('findById', () => {
    it('finds one agent scoped by workspace', async () => {
      const agent = { id: 'a1' } as ConnectedAgentEntity;

      (repository.findOne as jest.Mock).mockResolvedValue(agent);

      const result = await service.findById('a1', 'ws-1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'a1', workspaceId: 'ws-1' },
      });
      expect(result).toBe(agent);
    });
  });

  describe('setStatus', () => {
    it('updates status scoped by id+workspace and returns the reloaded agent', async () => {
      const updated = {
        id: 'a1',
        status: ConnectedAgentStatus.DISABLED,
      } as ConnectedAgentEntity;

      (repository.update as jest.Mock).mockResolvedValue(undefined);
      (repository.findOne as jest.Mock).mockResolvedValue(updated);

      const result = await service.setStatus(
        'a1',
        'ws-1',
        ConnectedAgentStatus.DISABLED,
      );

      expect(repository.update).toHaveBeenCalledWith(
        { id: 'a1', workspaceId: 'ws-1' },
        { status: ConnectedAgentStatus.DISABLED },
      );
      expect(result).toBe(updated);
    });
  });

  describe('softDelete', () => {
    it('soft-deletes the agent scoped by id+workspace', async () => {
      const softDelete = repository.softDelete as jest.Mock;

      await service.softDelete('a1', 'ws-1');

      expect(softDelete).toHaveBeenCalledWith({ id: 'a1', workspaceId: 'ws-1' });
    });
  });
});
