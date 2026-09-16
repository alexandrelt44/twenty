import { Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';

import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { ConnectedAgentStatus } from 'src/engine/core-modules/connected-agent/enums/connected-agent-status.enum';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

@Injectable()
export class ConnectedAgentService {
  constructor(
    @InjectWorkspaceScopedRepository(ConnectedAgentEntity)
    private readonly connectedAgentRepository: WorkspaceScopedRepository<ConnectedAgentEntity>,
  ) {}

  async findActiveByApiKeyId(
    apiKeyId: string,
    workspaceId: string,
  ): Promise<ConnectedAgentEntity | null> {
    return this.connectedAgentRepository.findOne(workspaceId, {
      where: {
        apiKeyId,
        status: ConnectedAgentStatus.ACTIVE,
        deletedAt: IsNull(),
      },
    });
  }

  async findByApiKeyId(
    apiKeyId: string,
    workspaceId: string,
  ): Promise<ConnectedAgentEntity | null> {
    return this.connectedAgentRepository.findOne(workspaceId, {
      where: { apiKeyId },
    });
  }

  async touchLastSeen(
    connectedAgentId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.connectedAgentRepository.update(
      workspaceId,
      { id: connectedAgentId },
      { lastSeenAt: new Date() },
    );
  }

  async findByWorkspaceId(
    workspaceId: string,
  ): Promise<ConnectedAgentEntity[]> {
    return this.connectedAgentRepository.find(workspaceId, {
      order: { createdAt: 'DESC' },
    });
  }

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<ConnectedAgentEntity | null> {
    return this.connectedAgentRepository.findOne(workspaceId, {
      where: { id },
    });
  }

  async setStatus(
    id: string,
    workspaceId: string,
    status: ConnectedAgentStatus,
  ): Promise<ConnectedAgentEntity | null> {
    await this.connectedAgentRepository.update(workspaceId, { id }, { status });

    return this.findById(id, workspaceId);
  }

  async softDelete(id: string, workspaceId: string): Promise<void> {
    await this.connectedAgentRepository.softDelete(workspaceId, { id });
  }
}
