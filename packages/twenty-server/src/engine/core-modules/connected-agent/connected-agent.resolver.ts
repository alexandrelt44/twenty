import { UseGuards } from '@nestjs/common';
import { Args, Mutation } from '@nestjs/graphql';

import { PermissionFlagType } from 'twenty-shared/constants';

import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { apiKeyGraphqlApiExceptionHandler } from 'src/engine/core-modules/api-key/utils/api-key-graphql-api-exception-handler.util';
import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { ConnectedAgentWithTokenDTO } from 'src/engine/core-modules/connected-agent/dtos/connected-agent-with-token.dto';
import { CreateConnectedAgentInput } from 'src/engine/core-modules/connected-agent/dtos/create-connected-agent.input';
import { ConnectedAgentProvisioningService } from 'src/engine/core-modules/connected-agent/services/connected-agent-provisioning.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@MetadataResolver(() => ConnectedAgentEntity)
@UseGuards(
  WorkspaceAuthGuard,
  SettingsPermissionGuard(PermissionFlagType.API_KEYS_AND_WEBHOOKS),
)
export class ConnectedAgentResolver {
  constructor(
    private readonly connectedAgentProvisioningService: ConnectedAgentProvisioningService,
  ) {}

  @Mutation(() => ConnectedAgentWithTokenDTO)
  async createConnectedAgent(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('input') input: CreateConnectedAgentInput,
  ): Promise<ConnectedAgentWithTokenDTO> {
    try {
      return await this.connectedAgentProvisioningService.provisionConnectedAgent(
        {
          name: input.name,
          description: input.description ?? null,
          roleId: input.roleId,
          workspaceId: workspace.id,
          expiresAt: new Date(input.expiresAt),
        },
      );
    } catch (error) {
      apiKeyGraphqlApiExceptionHandler(error);
      throw error;
    }
  }
}
