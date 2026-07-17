import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { IsNull, Repository } from 'typeorm';

import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { ConnectedAgentStatus } from 'src/engine/core-modules/connected-agent/enums/connected-agent-status.enum';

@Injectable()
export class ConnectedAgentService {
  constructor(
    @InjectRepository(ConnectedAgentEntity)
    private readonly connectedAgentRepository: Repository<ConnectedAgentEntity>,
  ) {}

  async findActiveByApiKeyId(
    apiKeyId: string,
    workspaceId: string,
  ): Promise<ConnectedAgentEntity | null> {
    return this.connectedAgentRepository.findOne({
      where: {
        apiKeyId,
        workspaceId,
        status: ConnectedAgentStatus.ACTIVE,
        deletedAt: IsNull(),
      },
    });
  }

  async touchLastSeen(
    connectedAgentId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.connectedAgentRepository.update(
      { id: connectedAgentId, workspaceId },
      { lastSeenAt: new Date() },
    );
  }
}
