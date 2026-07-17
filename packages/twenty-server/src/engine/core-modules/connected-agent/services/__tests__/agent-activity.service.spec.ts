import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { AgentActivityEntity } from 'src/engine/core-modules/connected-agent/agent-activity.entity';
import { AgentActivityType } from 'src/engine/core-modules/connected-agent/enums/agent-activity-type.enum';
import { AgentActivityService } from 'src/engine/core-modules/connected-agent/services/agent-activity.service';

describe('AgentActivityService', () => {
  let service: AgentActivityService;
  let repository: jest.Mocked<Repository<AgentActivityEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentActivityService,
        {
          provide: getRepositoryToken(AgentActivityEntity),
          useValue: { save: jest.fn(), find: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AgentActivityService);
    repository = module.get(getRepositoryToken(AgentActivityEntity));
  });

  it('should persist an activity with the given fields', async () => {
    repository.save.mockImplementation(async (a) => ({ id: 'act-1', ...a }) as never);

    const result = await service.record({
      connectedAgentId: 'agent-1',
      workspaceId: 'ws-1',
      type: AgentActivityType.PROMPT,
      summary: 'received a prompt',
      payload: { foo: 'bar' },
    });

    expect(repository.save).toHaveBeenCalledWith({
      connectedAgentId: 'agent-1',
      workspaceId: 'ws-1',
      type: AgentActivityType.PROMPT,
      summary: 'received a prompt',
      payload: { foo: 'bar' },
    });
    expect(result.id).toBe('act-1');
  });

  it('should list activity for an agent scoped by workspace, newest first', async () => {
    const rows = [{ id: 'act-2' }] as AgentActivityEntity[];

    repository.find.mockResolvedValue(rows);

    const result = await service.listForAgent('agent-1', 'ws-1', 10);

    expect(repository.find).toHaveBeenCalledWith({
      where: { connectedAgentId: 'agent-1', workspaceId: 'ws-1' },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    expect(result).toBe(rows);
  });
});
