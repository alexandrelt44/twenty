import { Injectable } from '@nestjs/common';

import { type AgentBridgeConnectResponse } from 'src/engine/api/agent-bridge/dtos/agent-bridge-connect.dto';
import { type ReportAgentEventInput } from 'src/engine/api/agent-bridge/dtos/report-agent-event.input';
import { AGENT_SESSION_TTL_MS } from 'src/engine/core-modules/connected-agent/constants/agent-session.const';
import { type ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { AgentActivityService } from 'src/engine/core-modules/connected-agent/services/agent-activity.service';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';

@Injectable()
export class AgentBridgeService {
  constructor(
    private readonly connectedAgentService: ConnectedAgentService,
    private readonly agentActivityService: AgentActivityService,
  ) {}

  async connect(
    agent: ConnectedAgentEntity,
    workspaceId: string,
  ): Promise<AgentBridgeConnectResponse> {
    await this.connectedAgentService.touchLastSeen(agent.id, workspaceId);

    return {
      connectedAgentId: agent.id,
      name: agent.name,
      status: agent.status,
      sessionTtlMs: AGENT_SESSION_TTL_MS,
      connectedAt: new Date().toISOString(),
    };
  }

  async heartbeat(
    agent: ConnectedAgentEntity,
    workspaceId: string,
  ): Promise<void> {
    await this.connectedAgentService.touchLastSeen(agent.id, workspaceId);
  }

  async reportEvent(
    agent: ConnectedAgentEntity,
    workspaceId: string,
    input: ReportAgentEventInput,
  ): Promise<void> {
    await this.connectedAgentService.touchLastSeen(agent.id, workspaceId);
    await this.agentActivityService.record({
      connectedAgentId: agent.id,
      workspaceId,
      type: input.type,
      summary: input.summary,
      payload: input.payload ?? null,
    });
  }
}
