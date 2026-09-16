import { Injectable } from '@nestjs/common';

import { type QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { AgentActivityEntity } from 'src/engine/core-modules/connected-agent/agent-activity.entity';
import { AgentActivityType } from 'src/engine/core-modules/connected-agent/enums/agent-activity-type.enum';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

type RecordActivityArgs = {
  connectedAgentId: string;
  workspaceId: string;
  type: AgentActivityType;
  summary: string;
  payload?: Record<string, unknown> | null;
};

@Injectable()
export class AgentActivityService {
  constructor(
    @InjectWorkspaceScopedRepository(AgentActivityEntity)
    private readonly agentActivityRepository: WorkspaceScopedRepository<AgentActivityEntity>,
  ) {}

  async record({
    connectedAgentId,
    workspaceId,
    type,
    summary,
    payload = null,
  }: RecordActivityArgs): Promise<AgentActivityEntity> {
    return this.agentActivityRepository.insertAndReturnOne(workspaceId, {
      connectedAgentId,
      type,
      summary,
      payload,
    } as QueryDeepPartialEntity<AgentActivityEntity>);
  }

  async listForAgent(
    connectedAgentId: string,
    workspaceId: string,
    limit = 50,
  ): Promise<AgentActivityEntity[]> {
    return this.agentActivityRepository.find(workspaceId, {
      where: { connectedAgentId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
