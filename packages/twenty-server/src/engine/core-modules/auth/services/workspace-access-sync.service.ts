import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isDefined } from 'twenty-shared/utils';
import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { Repository } from 'typeorm';

import { SignInUpService } from 'src/engine/core-modules/auth/services/sign-in-up.service';
import {
  type DirectoryMembership,
  type DirectoryUser,
  WorkspaceAccessDirectory,
} from 'src/engine/core-modules/auth/services/workspace-access-directory';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { RoleEntity } from 'src/engine/metadata-modules/role/role.entity';
import { UserRoleService } from 'src/engine/metadata-modules/user-role/user-role.service';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { type WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { STANDARD_ROLE } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-role.constant';

const DIRECTORY_ADMIN_ROLE_SLUG = 'admin';

export type WorkspaceAccessSyncOutcome =
  | 'disabled'
  | 'not-linked'
  | 'user-not-found'
  | 'email-not-verified'
  | 'created'
  | 'added'
  | 'role-updated'
  | 'removed'
  | 'kept-last-member'
  | 'kept-last-admin'
  | 'workspace-pending'
  | 'unchanged';

@Injectable()
export class WorkspaceAccessSyncService {
  private readonly logger = new Logger(WorkspaceAccessSyncService.name);

  constructor(
    private readonly directory: WorkspaceAccessDirectory,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    @InjectWorkspaceScopedRepository(RoleEntity)
    private readonly roleRepository: WorkspaceScopedRepository<RoleEntity>,
    private readonly signInUpService: SignInUpService,
    private readonly userWorkspaceService: UserWorkspaceService,
    private readonly userService: UserService,
    private readonly userRoleService: UserRoleService,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {}

  isEnabled(): boolean {
    return this.directory.isEnabled();
  }

  // Called on sign-in when the user has no invitation: gives access to the
  // workspace if one of the user's directory organizations is linked to it.
  async grantAccessOnSignIn({
    directoryUserId,
    workspaceId,
  }: {
    directoryUserId: string;
    workspaceId: string;
  }): Promise<boolean> {
    if (!this.directory.isEnabled()) {
      return false;
    }

    const memberships = await this.directory.listMemberships(directoryUserId);

    for (const membership of memberships.filter(({ isActive }) => isActive)) {
      const linkedWorkspaceId =
        await this.directory.findWorkspaceIdForOrganization(
          membership.organizationId,
        );

      if (linkedWorkspaceId !== workspaceId) {
        continue;
      }

      const outcome = await this.syncMembership({
        directoryUserId,
        organizationId: membership.organizationId,
      });

      return ['created', 'added', 'role-updated', 'unchanged'].includes(
        outcome,
      );
    }

    return false;
  }

  // Brings the CRM in line with the directory's current state for one
  // membership. It reads that state instead of trusting the event payload, so
  // repeated and out-of-order events end in the same result.
  async syncMembership({
    directoryUserId,
    organizationId,
    workspaceId: knownWorkspaceId,
  }: {
    directoryUserId: string;
    organizationId: string;
    workspaceId?: string;
  }): Promise<WorkspaceAccessSyncOutcome> {
    if (!this.directory.isEnabled()) {
      return 'disabled';
    }

    const workspaceId =
      knownWorkspaceId ??
      (await this.directory.findWorkspaceIdForOrganization(organizationId));

    if (!isDefined(workspaceId)) {
      return 'not-linked';
    }

    const workspace = await this.workspaceRepository.findOneBy({
      id: workspaceId,
    });

    if (!isDefined(workspace)) {
      this.logger.warn(
        `Directory organization ${organizationId} points to missing workspace ${workspaceId}`,
      );

      return 'not-linked';
    }

    // A workspace is activated by its first member, which the ColabAuth
    // tenant flow handles; adding someone before that would fail.
    if (
      workspace.activationStatus ===
        WorkspaceActivationStatus.PENDING_CREATION ||
      workspace.activationStatus === WorkspaceActivationStatus.ONGOING_CREATION
    ) {
      return 'workspace-pending';
    }

    const directoryUser = await this.directory.findUser(directoryUserId);

    if (!isDefined(directoryUser)) {
      return 'user-not-found';
    }

    const memberships = await this.directory.listMemberships(directoryUserId);
    const activeMembership = memberships.find(
      (membership) =>
        membership.organizationId === organizationId && membership.isActive,
    );

    const user = await this.userRepository.findOne({
      where: { email: directoryUser.email },
      relations: { userWorkspaces: true },
    });
    const userWorkspace = user?.userWorkspaces.find(
      (candidate) => candidate.workspaceId === workspace.id,
    );

    if (isDefined(activeMembership)) {
      return this.grantMembership({
        workspace,
        directoryUser,
        user,
        userWorkspace,
        membership: activeMembership,
      });
    }

    if (!isDefined(user) || !isDefined(userWorkspace)) {
      return 'unchanged';
    }

    return this.revokeMembership({ workspace, user, userWorkspace });
  }

  private async grantMembership({
    workspace,
    directoryUser,
    user,
    userWorkspace,
    membership,
  }: {
    workspace: WorkspaceEntity;
    directoryUser: DirectoryUser;
    user: UserEntity | null;
    userWorkspace: UserWorkspaceEntity | undefined;
    membership: DirectoryMembership;
  }): Promise<WorkspaceAccessSyncOutcome> {
    const adminRoleId = await this.findAdminRoleId(workspace.id);
    const isDirectoryAdmin = membership.roleSlug === DIRECTORY_ADMIN_ROLE_SLUG;
    const roleId =
      isDirectoryAdmin && isDefined(adminRoleId) ? adminRoleId : undefined;

    if (!isDefined(user)) {
      if (!directoryUser.isEmailVerified) {
        return 'email-not-verified';
      }

      await this.signInUpService.signInUp({
        workspace,
        roleId,
        userData: {
          type: 'newUserWithPicture',
          newUserWithPicture: {
            email: directoryUser.email,
            firstName: directoryUser.firstName ?? '',
            lastName: directoryUser.lastName ?? '',
            picture: '',
            locale: 'en',
            isEmailVerified: true,
          },
        },
        authParams: { provider: AuthProviderEnum.Google },
      });

      return 'created';
    }

    if (!isDefined(userWorkspace)) {
      await this.userWorkspaceService.addUserToWorkspaceIfUserNotInWorkspace(
        user,
        workspace,
        roleId,
      );

      return 'added';
    }

    if (!isDefined(adminRoleId)) {
      return 'unchanged';
    }

    const userWorkspaceRoleMap = await this.getUserWorkspaceRoleMap(
      workspace.id,
    );
    const isCrmAdmin = userWorkspaceRoleMap[userWorkspace.id] === adminRoleId;

    // Only the Admin role follows the directory; any other role set in the
    // CRM is left alone.
    if (isDirectoryAdmin === isCrmAdmin) {
      return 'unchanged';
    }

    if (
      isCrmAdmin &&
      this.countAdmins(userWorkspaceRoleMap, adminRoleId) <= 1
    ) {
      this.logger.warn(
        `Kept ${userWorkspace.id} as the last Admin of workspace ${workspace.id}`,
      );

      return 'kept-last-admin';
    }

    const newRoleId = isDirectoryAdmin ? adminRoleId : workspace.defaultRoleId;

    if (!isDefined(newRoleId)) {
      return 'unchanged';
    }

    await this.userRoleService.assignRoleToManyUserWorkspace({
      workspaceId: workspace.id,
      userWorkspaceIds: [userWorkspace.id],
      roleId: newRoleId,
    });

    return 'role-updated';
  }

  private async revokeMembership({
    workspace,
    user,
    userWorkspace,
  }: {
    workspace: WorkspaceEntity;
    user: UserEntity;
    userWorkspace: UserWorkspaceEntity;
  }): Promise<WorkspaceAccessSyncOutcome> {
    const memberCount = await this.userWorkspaceRepository.count({
      where: { workspaceId: workspace.id },
    });

    // Removing the last member deletes the whole workspace downstream.
    if (memberCount <= 1) {
      this.logger.warn(
        `Kept ${userWorkspace.id} as the last member of workspace ${workspace.id}`,
      );

      return 'kept-last-member';
    }

    const adminRoleId = await this.findAdminRoleId(workspace.id);

    if (isDefined(adminRoleId)) {
      const userWorkspaceRoleMap = await this.getUserWorkspaceRoleMap(
        workspace.id,
      );

      if (
        userWorkspaceRoleMap[userWorkspace.id] === adminRoleId &&
        this.countAdmins(userWorkspaceRoleMap, adminRoleId) <= 1
      ) {
        this.logger.warn(
          `Kept ${userWorkspace.id} as the last Admin of workspace ${workspace.id}`,
        );

        return 'kept-last-admin';
      }
    }

    await this.userService.deleteUserWorkspaceAndPotentiallyDeleteUser({
      userId: user.id,
      workspaceId: workspace.id,
    });

    return 'removed';
  }

  private async findAdminRoleId(workspaceId: string): Promise<string | null> {
    const adminRole = await this.roleRepository.findOne(workspaceId, {
      where: { universalIdentifier: STANDARD_ROLE.admin.universalIdentifier },
    });

    return adminRole?.id ?? null;
  }

  private async getUserWorkspaceRoleMap(
    workspaceId: string,
  ): Promise<Record<string, string>> {
    const { userWorkspaceRoleMap } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'userWorkspaceRoleMap',
      ]);

    return userWorkspaceRoleMap;
  }

  private countAdmins(
    userWorkspaceRoleMap: Record<string, string>,
    adminRoleId: string,
  ): number {
    return Object.values(userWorkspaceRoleMap).filter(
      (roleId) => roleId === adminRoleId,
    ).length;
  }
}
