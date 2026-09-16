import { Test, type TestingModule } from '@nestjs/testing';

import { AgentActivityEntity } from 'src/engine/core-modules/connected-agent/agent-activity.entity';
import { AgentActivityType } from 'src/engine/core-modules/connected-agent/enums/agent-activity-type.enum';
import { AgentActivityService } from 'src/engine/core-modules/connected-agent/services/agent-activity.service';
import { getWorkspaceScopedRepositoryToken } from 'src/engine/twenty-orm/workspace-scoped-repository/get-workspace-scoped-repository-token.util';
import { type WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

describe('AgentActivityService', () => {
  let service: AgentActivityService;
  let repository: jest.Mocked<WorkspaceScopedRepository<AgentActivityEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentActivityService,
        {
          provide: getWorkspaceScopedRepositoryToken(AgentActivityEntity),
          useValue: { insertAndReturnOne: jest.fn(), find: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AgentActivityService);
    repository = module.get(
      getWorkspaceScopedRepositoryToken(AgentActivityEntity),
    );
  });

  it('should persist an activity with the given fields', async () => {
    repository.insertAndReturnOne.mockImplementation(
      async (_workspaceId, activity) => ({ id: 'act-1', ...activity }) as never,
    );

    const result = await service.record({
      connectedAgentId: 'agent-1',
      workspaceId: 'ws-1',
      type: AgentActivityType.PROMPT,
      summary: 'received a prompt',
      payload: { foo: 'bar' },
    });

    expect(repository.insertAndReturnOne).toHaveBeenCalledWith('ws-1', {
      connectedAgentId: 'agent-1',
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

    expect(repository.find).toHaveBeenCalledWith('ws-1', {
      where: { connectedAgentId: 'agent-1' },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    expect(result).toBe(rows);
  });
});
