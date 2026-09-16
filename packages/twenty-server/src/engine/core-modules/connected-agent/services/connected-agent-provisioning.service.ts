import { Injectable, Logger } from '@nestjs/common';
import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

type ProvisionConnectedAgentArgs = {
  name: string;
  description: string | null;
  roleId: string;
  workspaceId: string;
  expiresAt: Date;
};

type ProvisionConnectedAgentResult = {
  connectedAgent: ConnectedAgentEntity;
  token: string;
};

@Injectable()
export class ConnectedAgentProvisioningService {
  private readonly logger = new Logger(ConnectedAgentProvisioningService.name);

  constructor(
    @InjectWorkspaceScopedRepository(ConnectedAgentEntity)
    private readonly connectedAgentRepository: WorkspaceScopedRepository<ConnectedAgentEntity>,
    private readonly apiKeyService: ApiKeyService,
    private readonly connectedAgentService: ConnectedAgentService,
  ) {}

  async provisionConnectedAgent({
    name,
    description,
    roleId,
    workspaceId,
    expiresAt,
  }: ProvisionConnectedAgentArgs): Promise<ProvisionConnectedAgentResult> {
    const apiKey = await this.apiKeyService.create({
      name,
      expiresAt,
      workspaceId,
      roleId,
    });

    try {
      const apiKeyToken = await this.apiKeyService.generateApiKeyToken(
        workspaceId,
        apiKey.id,
        expiresAt,
      );

      if (!apiKeyToken) {
        throw new Error('Failed to generate token for connected agent');
      }

      const connectedAgent =
        await this.connectedAgentRepository.insertAndReturnOne(workspaceId, {
          name,
          description,
          apiKeyId: apiKey.id,
        });

      return { connectedAgent, token: apiKeyToken.token };
    } catch (error) {
      try {
        await this.apiKeyService.revoke(apiKey.id, workspaceId);
      } catch (revokeError) {
        // Cleanup failure must not mask the original error, but is worth
        // surfacing so an orphaned, live API key can be investigated.
        this.logger.error(
          `Failed to revoke orphaned API key ${apiKey.id} for workspace ${workspaceId} after provisioning failure`,
          revokeError,
        );
      }

      throw error;
    }
  }

  async deleteConnectedAgent(
    id: string,
    workspaceId: string,
  ): Promise<boolean> {
    const connectedAgent = await this.connectedAgentService.findById(
      id,
      workspaceId,
    );

    if (connectedAgent === null) {
      return false;
    }

    await this.apiKeyService.revoke(connectedAgent.apiKeyId, workspaceId);
    await this.connectedAgentService.softDelete(id, workspaceId);

    return true;
  }
}
