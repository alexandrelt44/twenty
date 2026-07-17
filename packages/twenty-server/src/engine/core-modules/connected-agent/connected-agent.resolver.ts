import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField } from '@nestjs/graphql';

import { PermissionFlagType } from 'twenty-shared/constants';

import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { ApiKeyRoleService } from 'src/engine/core-modules/api-key/services/api-key-role.service';
import { apiKeyGraphqlApiExceptionHandler } from 'src/engine/core-modules/api-key/utils/api-key-graphql-api-exception-handler.util';
import { AgentActivityEntity } from 'src/engine/core-modules/connected-agent/agent-activity.entity';
import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { ConnectedAgentWithTokenDTO } from 'src/engine/core-modules/connected-agent/dtos/connected-agent-with-token.dto';
import { CreateConnectedAgentInput } from 'src/engine/core-modules/connected-agent/dtos/create-connected-agent.input';
import { DeleteConnectedAgentInput } from 'src/engine/core-modules/connected-agent/dtos/delete-connected-agent.input';
import { GetConnectedAgentActivityInput } from 'src/engine/core-modules/connected-agent/dtos/get-connected-agent-activity.input';
import { GetConnectedAgentInput } from 'src/engine/core-modules/connected-agent/dtos/get-connected-agent.input';
import { SetConnectedAgentStatusInput } from 'src/engine/core-modules/connected-agent/dtos/set-connected-agent-status.input';
import { AgentActivityService } from 'src/engine/core-modules/connected-agent/services/agent-activity.service';
import { ConnectedAgentProvisioningService } from 'src/engine/core-modules/connected-agent/services/connected-agent-provisioning.service';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { RoleDTO } from 'src/engine/metadata-modules/role/dtos/role.dto';

@MetadataResolver(() => ConnectedAgentEntity)
@UseGuards(
  WorkspaceAuthGuard,
  SettingsPermissionGuard(PermissionFlagType.API_KEYS_AND_WEBHOOKS),
)
export class ConnectedAgentResolver {
  constructor(
    private readonly connectedAgentProvisioningService: ConnectedAgentProvisioningService,
    private readonly connectedAgentService: ConnectedAgentService,
    private readonly agentActivityService: AgentActivityService,
    private readonly apiKeyRoleService: ApiKeyRoleService,
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

  @Query(() => [ConnectedAgentEntity])
  async connectedAgents(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<ConnectedAgentEntity[]> {
    return this.connectedAgentService.findByWorkspaceId(workspace.id);
  }

  @Query(() => ConnectedAgentEntity, { nullable: true })
  async connectedAgent(
    @Args('input') input: GetConnectedAgentInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<ConnectedAgentEntity | null> {
    return this.connectedAgentService.findById(input.id, workspace.id);
  }

  @Query(() => [AgentActivityEntity])
  async connectedAgentActivity(
    @Args('input') input: GetConnectedAgentActivityInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<AgentActivityEntity[]> {
    return this.agentActivityService.listForAgent(
      input.connectedAgentId,
      workspace.id,
    );
  }

  @ResolveField(() => RoleDTO, { nullable: true })
  async role(
    @Parent() connectedAgent: ConnectedAgentEntity,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<RoleDTO | null> {
    // getRoleDtoByApiKeyId THROWS (API_KEY_NO_ROLE_ASSIGNED) when the key has
    // no role. Provisioned agents always have one, but tolerate a role-less
    // agent gracefully so the list query never breaks on a single bad row.
    try {
      return await this.apiKeyRoleService.getRoleDtoByApiKeyId({
        apiKeyId: connectedAgent.apiKeyId,
        workspaceId: workspace.id,
      });
    } catch {
      return null;
    }
  }

  @Mutation(() => ConnectedAgentEntity, { nullable: true })
  async setConnectedAgentStatus(
    @Args('input') input: SetConnectedAgentStatusInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<ConnectedAgentEntity | null> {
    return this.connectedAgentService.setStatus(
      input.id,
      workspace.id,
      input.status,
    );
  }

  @Mutation(() => Boolean)
  async deleteConnectedAgent(
    @Args('input') input: DeleteConnectedAgentInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<boolean> {
    return this.connectedAgentProvisioningService.deleteConnectedAgent(
      input.id,
      workspace.id,
    );
  }
}
