import { Test, type TestingModule } from '@nestjs/testing';

import { AgentBridgeService } from 'src/engine/api/agent-bridge/services/agent-bridge.service';
import { AgentActivityType } from 'src/engine/core-modules/connected-agent/enums/agent-activity-type.enum';
import { AgentActivityService } from 'src/engine/core-modules/connected-agent/services/agent-activity.service';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';

describe('AgentBridgeService', () => {
  let service: AgentBridgeService;
  let connectedAgentService: jest.Mocked<ConnectedAgentService>;
  let agentActivityService: jest.Mocked<AgentActivityService>;

  const agent = { id: 'agent-1', name: 'ProofBot', status: 'ACTIVE' } as never;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentBridgeService,
        {
          provide: ConnectedAgentService,
          useValue: { touchLastSeen: jest.fn() },
        },
        { provide: AgentActivityService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(AgentBridgeService);
    connectedAgentService = module.get(ConnectedAgentService);
    agentActivityService = module.get(AgentActivityService);
  });

  it('connect refreshes lastSeenAt and returns the agent identity + ttl', async () => {
    const result = await service.connect(agent, 'ws-1');

    expect(connectedAgentService.touchLastSeen).toHaveBeenCalledWith(
      'agent-1',
      'ws-1',
    );
    expect(result.connectedAgentId).toBe('agent-1');
    expect(result.name).toBe('ProofBot');
    expect(result.sessionTtlMs).toBe(300_000);
  });

  it('heartbeat refreshes lastSeenAt', async () => {
    await service.heartbeat(agent, 'ws-1');
    expect(connectedAgentService.touchLastSeen).toHaveBeenCalledWith(
      'agent-1',
      'ws-1',
    );
  });

  it('reportEvent refreshes lastSeenAt and records the activity', async () => {
    await service.reportEvent(agent, 'ws-1', {
      type: AgentActivityType.PROMPT,
      summary: 'hi',
      payload: { a: 1 },
    });

    expect(connectedAgentService.touchLastSeen).toHaveBeenCalledWith(
      'agent-1',
      'ws-1',
    );
    expect(agentActivityService.record).toHaveBeenCalledWith({
      connectedAgentId: 'agent-1',
      workspaceId: 'ws-1',
      type: AgentActivityType.PROMPT,
      summary: 'hi',
      payload: { a: 1 },
    });
  });
});
