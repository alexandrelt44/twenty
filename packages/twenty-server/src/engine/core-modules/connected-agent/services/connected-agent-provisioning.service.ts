import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';

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
  constructor(
    @InjectRepository(ConnectedAgentEntity)
    private readonly connectedAgentRepository: Repository<ConnectedAgentEntity>,
    private readonly apiKeyService: ApiKeyService,
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

      const connectedAgent = await this.connectedAgentRepository.save({
        name,
        description,
        apiKeyId: apiKey.id,
        workspaceId,
      });

      return { connectedAgent, token: apiKeyToken.token };
    } catch (error) {
      try {
        await this.apiKeyService.revoke(apiKey.id, workspaceId);
      } catch (revokeError) {
        // Cleanup failure must not mask the original error, but is worth
        // surfacing so an orphaned, live API key can be investigated.
        console.error(
          `Failed to revoke orphaned API key ${apiKey.id} for workspace ${workspaceId} after provisioning failure`,
          revokeError,
        );
      }

      throw error;
    }
  }
}
