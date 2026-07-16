import { Command } from 'nest-commander';
import { EntityMetadataNotFoundError } from 'typeorm/error/EntityMetadataNotFoundError';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkflowVersionCoreSyncService } from 'src/engine/core-modules/workflow/services/workflow-version-core-sync.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type WorkflowVersionWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow-version.workspace-entity';

// Re-run of the workflowVersion core sync after coreWorkflowVersionId is
// provisioned. The original backfill skips the write-back on workspaces that
// lacked the field; this links them once it exists. The deterministic core id
// makes the upsert reuse the rows the original backfill already created.
@RegisteredWorkspaceCommand('2.22.0', 1784193207000)
@Command({
  name: 'upgrade:2-22:backfill-workflow-version-core-links',
  description:
    'Re-run the workflowVersion core sync so workspaces newly provisioned with coreWorkflowVersionId get linked',
})
export class BackfillWorkflowVersionCoreLinksCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly workflowVersionCoreSyncService: WorkflowVersionCoreSyncService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    let workspaceWorkflowVersions: WorkflowVersionWorkspaceEntity[];

    try {
      workspaceWorkflowVersions =
        await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
          async () => {
            const workflowVersionRepository =
              await this.globalWorkspaceOrmManager.getRepository<WorkflowVersionWorkspaceEntity>(
                workspaceId,
                'workflowVersion',
                { shouldBypassPermissionChecks: true },
              );

            return workflowVersionRepository.find();
          },
          buildSystemAuthContext(workspaceId),
        );
    } catch (error) {
      if (error instanceof EntityMetadataNotFoundError) {
        this.logger.log(
          `workflowVersion object does not exist for workspace ${workspaceId}, skipping`,
        );

        return;
      }

      throw error;
    }

    if (options.dryRun === true) {
      this.logger.log(
        `[DRY RUN] Would re-sync ${workspaceWorkflowVersions.length} workflowVersion row(s) for workspace ${workspaceId}`,
      );

      return;
    }

    await this.workflowVersionCoreSyncService.upsertToCore(
      workspaceId,
      workspaceWorkflowVersions,
    );

    this.logger.log(
      `Linked ${workspaceWorkflowVersions.length} workflowVersion row(s) for workspace ${workspaceId}`,
    );
  }
}
