import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { AgentActivityEntity } from 'src/engine/core-modules/connected-agent/agent-activity.entity';
import { AgentActivityType } from 'src/engine/core-modules/connected-agent/enums/agent-activity-type.enum';

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
    @InjectRepository(AgentActivityEntity)
    private readonly agentActivityRepository: Repository<AgentActivityEntity>,
  ) {}

  async record({
    connectedAgentId,
    workspaceId,
    type,
    summary,
    payload = null,
  }: RecordActivityArgs): Promise<AgentActivityEntity> {
    return this.agentActivityRepository.save({
      connectedAgentId,
      workspaceId,
      type,
      summary,
      payload,
    });
  }

  async listForAgent(
    connectedAgentId: string,
    workspaceId: string,
    limit = 50,
  ): Promise<AgentActivityEntity[]> {
    return this.agentActivityRepository.find({
      where: { connectedAgentId, workspaceId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
