import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { isDefined } from 'twenty-shared/utils';
import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { DataSource, IsNull, type QueryRunner, Repository } from 'typeorm';
import { v4 } from 'uuid';

import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { WorkspaceAccessDirectory } from 'src/engine/core-modules/auth/services/workspace-access-directory';
import {
  WorkspaceAccessSyncService,
  type WorkspaceAccessSyncOutcome,
} from 'src/engine/core-modules/auth/services/workspace-access-sync.service';
import {
  type ColabauthMemberRole,
  type ColabauthMembershipAction,
  type ColabauthMembershipSyncResult,
  type ColabauthTenant,
  type ColabauthTenantMember,
  type ColabauthTenantStatus,
} from 'src/engine/core-modules/colabauth/types/colabauth-tenant.type';
import { SubdomainManagerService } from 'src/engine/core-modules/domain/subdomain-manager/services/subdomain-manager.service';
import { WorkspaceDomainsService } from 'src/engine/core-modules/domain/workspace-domains/services/workspace-domains.service';
import {
  KeyValuePairEntity,
  KeyValuePairType,
} from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { fromUserEntityToFlat } from 'src/engine/core-modules/user/utils/from-user-entity-to-flat.util';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { RoleEntity } from 'src/engine/metadata-modules/role/role.entity';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { type WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { STANDARD_ROLE } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-role.constant';

const WORKOS_ORGANIZATION_LINK_KEY = 'COLABAUTH_WORKOS_ORGANIZATION_ID';

const PENDING_STATUSES: WorkspaceActivationStatus[] = [
  WorkspaceActivationStatus.PENDING_CREATION,
  WorkspaceActivationStatus.ONGOING_CREATION,
];

const ACTION_BY_OUTCOME: Partial<
  Record<WorkspaceAccessSyncOutcome, ColabauthMembershipAction>
> = {
  created: 'created',
  added: 'created',
  'role-updated': 'updated',
  removed: 'removed',
};

@Injectable()
export class ColabauthTenantService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    @InjectRepository(KeyValuePairEntity)
    private readonly keyValuePairRepository: Repository<KeyValuePairEntity>,
    @InjectWorkspaceScopedRepository(RoleEntity)
    private readonly roleRepository: WorkspaceScopedRepository<RoleEntity>,
    private readonly applicationService: ApplicationService,
    private readonly workspaceService: WorkspaceService,
    private readonly workspaceDomainsService: WorkspaceDomainsService,
    private readonly subdomainManagerService: SubdomainManagerService,
    private readonly userWorkspaceService: UserWorkspaceService,
    private readonly workspaceAccessSyncService: WorkspaceAccessSyncService,
    private readonly directory: WorkspaceAccessDirectory,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {}

  async createTenant({
    name,
    slug,
    workosOrganizationId,
  }: {
    name: string;
    slug: string;
    workosOrganizationId: string;
  }): Promise<{ created: boolean; tenant: ColabauthTenant }> {
    const linkedWorkspaceId =
      await this.findWorkspaceIdForOrganization(workosOrganizationId);

    if (isDefined(linkedWorkspaceId)) {
      return {
        created: false,
        tenant: await this.getTenant(linkedWorkspaceId),
      };
    }

    const workspaceWithSlug = await this.workspaceRepository.findOne({
      where: { subdomain: slug },
      withDeleted: true,
    });

    if (isDefined(workspaceWithSlug)) {
      throw new ConflictException('Slug is used by another tenant');
    }

    try {
      await this.subdomainManagerService.validateSubdomainOrThrow(slug);
    } catch {
      throw new BadRequestException('Slug is not a valid subdomain');
    }

    const workspaceId = v4();
    const workspaceCustomApplicationId = v4();

    await this.dataSource.transaction(async (entityManager) => {
      const queryRunner = entityManager.queryRunner as QueryRunner;

      await queryRunner.manager.save(
        WorkspaceEntity,
        this.workspaceRepository.create({
          id: workspaceId,
          subdomain: slug,
          workspaceCustomApplicationId,
          displayName: name,
          inviteHash: v4(),
          activationStatus: WorkspaceActivationStatus.PENDING_CREATION,
        }),
      );

      await this.applicationService.createWorkspaceCustomApplication(
        { workspaceId, applicationId: workspaceCustomApplicationId },
        queryRunner,
      );

      await queryRunner.manager.save(
        KeyValuePairEntity,
        this.keyValuePairRepository.create({
          workspaceId,
          userId: null,
          key: WORKOS_ORGANIZATION_LINK_KEY,
          value: workosOrganizationId as unknown as JSON,
          type: KeyValuePairType.CONFIG_VARIABLE,
        }),
      );
    });

    return { created: true, tenant: await this.getTenant(workspaceId) };
  }

  async getTenant(workspaceId: string): Promise<ColabauthTenant> {
    const workspace = await this.findWorkspaceOrThrow(workspaceId);

    return this.toTenant(workspace);
  }

  async findTenantByOrganization(
    workosOrganizationId: string,
  ): Promise<ColabauthTenant | null> {
    const workspaceId =
      await this.findWorkspaceIdForOrganization(workosOrganizationId);

    return isDefined(workspaceId) ? this.getTenant(workspaceId) : null;
  }

  async suspendTenant(workspaceId: string): Promise<ColabauthTenant> {
    await this.findWorkspaceOrThrow(workspaceId);
    await this.workspaceService.suspendWorkspace(workspaceId);

    return this.getTenant(workspaceId);
  }

  async reactivateTenant(workspaceId: string): Promise<ColabauthTenant> {
    await this.findWorkspaceOrThrow(workspaceId);
    await this.workspaceService.reactivateWorkspace(workspaceId);

    return this.getTenant(workspaceId);
  }

  async syncMembership({
    workosUserId,
    workosOrganizationId,
  }: {
    workosUserId: string;
    workosOrganizationId: string;
  }): Promise<ColabauthMembershipSyncResult> {
    const workspaceId =
      (await this.findWorkspaceIdForOrganization(workosOrganizationId)) ??
      (await this.directory.findWorkspaceIdForOrganization(
        workosOrganizationId,
      ));

    const workspace = isDefined(workspaceId)
      ? await this.workspaceRepository.findOneBy({ id: workspaceId })
      : null;

    if (!isDefined(workspace)) {
      return { action: 'noop', role: null };
    }

    const directoryUser = await this.directory.findUser(workosUserId);

    if (PENDING_STATUSES.includes(workspace.activationStatus)) {
      const isActivated = await this.activateWithFirstMember({
        workspace,
        workosUserId,
        workosOrganizationId,
      });

      return isActivated && isDefined(directoryUser)
        ? {
            action: 'created',
            role: await this.findMemberRole(workspace.id, directoryUser.email),
          }
        : { action: 'noop', role: null };
    }

    const outcome = await this.workspaceAccessSyncService.syncMembership({
      directoryUserId: workosUserId,
      organizationId: workosOrganizationId,
      workspaceId: workspace.id,
    });

    return {
      action: ACTION_BY_OUTCOME[outcome] ?? 'noop',
      role: isDefined(directoryUser)
        ? await this.findMemberRole(workspace.id, directoryUser.email)
        : null,
    };
  }

  // Brings every member in line with the WorkOS organization. Members without
  // a WorkOS account were added another way and are left alone.
  async syncTenant(workspaceId: string): Promise<{
    results: {
      workosUserId: string | null;
      email: string | null;
      action: ColabauthMembershipAction | 'unmanaged';
    }[];
  }> {
    await this.findWorkspaceOrThrow(workspaceId);

    const workosOrganizationId =
      await this.findOrganizationIdForWorkspace(workspaceId);

    if (!isDefined(workosOrganizationId)) {
      throw new NotFoundException('Tenant is not linked to an organization');
    }

    const results: {
      workosUserId: string | null;
      email: string | null;
      action: ColabauthMembershipAction | 'unmanaged';
    }[] = [];
    const syncedEmails = new Set<string>();

    const organizationMembers =
      await this.directory.listOrganizationMembers(workosOrganizationId);

    // Admins first, so a pending workspace is activated by an admin when
    // there is one.
    const orderedMembers = [...organizationMembers].sort(
      (left, right) =>
        Number(right.roleSlug === 'admin') - Number(left.roleSlug === 'admin'),
    );

    for (const member of orderedMembers) {
      const { action } = await this.syncMembership({
        workosUserId: member.directoryUserId,
        workosOrganizationId,
      });
      const directoryUser = await this.directory.findUser(
        member.directoryUserId,
      );

      if (isDefined(directoryUser)) {
        syncedEmails.add(directoryUser.email);
      }

      results.push({
        workosUserId: member.directoryUserId,
        email: directoryUser?.email ?? null,
        action,
      });
    }

    const crmMembers = await this.userWorkspaceRepository.find({
      where: { workspaceId },
      relations: { user: true },
    });

    for (const { user } of crmMembers) {
      const email = user.email.toLowerCase();

      if (syncedEmails.has(email)) {
        continue;
      }

      const directoryUser = await this.directory.findUserByEmail(email);

      if (!isDefined(directoryUser)) {
        results.push({ workosUserId: null, email, action: 'unmanaged' });
        continue;
      }

      const { action } = await this.syncMembership({
        workosUserId: directoryUser.id,
        workosOrganizationId,
      });

      results.push({ workosUserId: directoryUser.id, email, action });
    }

    return { results };
  }

  // The first person synced into a pending workspace activates it, and
  // activation makes that person the workspace Admin.
  private async activateWithFirstMember({
    workspace,
    workosUserId,
    workosOrganizationId,
  }: {
    workspace: WorkspaceEntity;
    workosUserId: string;
    workosOrganizationId: string;
  }): Promise<boolean> {
    const memberships = await this.directory.listMemberships(workosUserId);
    const isActiveMember = memberships.some(
      (membership) =>
        membership.organizationId === workosOrganizationId &&
        membership.isActive,
    );
    const directoryUser = await this.directory.findUser(workosUserId);

    if (
      workspace.activationStatus !==
        WorkspaceActivationStatus.PENDING_CREATION ||
      !isActiveMember ||
      !isDefined(directoryUser) ||
      !directoryUser.isEmailVerified
    ) {
      return false;
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: directoryUser.email },
    });
    const pendingMembers = await this.userWorkspaceRepository.find({
      where: { workspaceId: workspace.id },
    });

    // Someone else already started activating this workspace; this person is
    // added through the normal sync once it is active.
    if (
      pendingMembers.some(
        (pendingMember) => pendingMember.userId !== existingUser?.id,
      )
    ) {
      return false;
    }
    const user =
      existingUser ??
      (await this.userRepository.save(
        this.userRepository.create({
          email: directoryUser.email,
          firstName: directoryUser.firstName ?? '',
          lastName: directoryUser.lastName ?? '',
          isEmailVerified: true,
          locale: 'en',
          canImpersonate: false,
          canAccessFullAdminPanel: false,
        }),
      ));

    if (pendingMembers.length === 0) {
      const application = await this.applicationService.findById(
        workspace.workspaceCustomApplicationId,
      );

      await this.userWorkspaceService.create({
        userId: user.id,
        workspaceId: workspace.id,
        isExistingUser: isDefined(existingUser),
        applicationUniversalIdentifier: application?.universalIdentifier,
        locale: user.locale,
      });
    }

    await this.workspaceService.activateWorkspace(
      fromUserEntityToFlat(user),
      workspace,
    );

    return true;
  }

  private async toTenant(workspace: WorkspaceEntity): Promise<ColabauthTenant> {
    const workosOrganizationId = await this.findOrganizationIdForWorkspace(
      workspace.id,
    );

    return {
      id: workspace.id,
      name: workspace.displayName ?? '',
      slug: workspace.subdomain,
      url: this.workspaceDomainsService.getWorkspaceUrls(workspace)
        .subdomainUrl,
      status: this.toStatus(workspace.activationStatus),
      workosOrganizationId,
      members: await this.listMembers(workspace, workosOrganizationId),
    };
  }

  private async listMembers(
    workspace: WorkspaceEntity,
    workosOrganizationId: string | null,
  ): Promise<ColabauthTenantMember[]> {
    if (PENDING_STATUSES.includes(workspace.activationStatus)) {
      return [];
    }

    const userWorkspaces = await this.userWorkspaceRepository.find({
      where: { workspaceId: workspace.id },
      relations: { user: true },
    });

    const workosUserIdByEmail = new Map<string, string>();

    if (isDefined(workosOrganizationId)) {
      for (const member of await this.directory.listOrganizationMembers(
        workosOrganizationId,
      )) {
        const directoryUser = await this.directory.findUser(
          member.directoryUserId,
        );

        if (isDefined(directoryUser)) {
          workosUserIdByEmail.set(directoryUser.email, directoryUser.id);
        }
      }
    }

    const roleByUserWorkspaceId = await this.getRoleByUserWorkspaceId(
      workspace.id,
    );

    return userWorkspaces.map((userWorkspace) => {
      const email = userWorkspace.user.email.toLowerCase();

      return {
        workosUserId: workosUserIdByEmail.get(email) ?? null,
        email,
        role: roleByUserWorkspaceId.get(userWorkspace.id) ?? 'member',
      };
    });
  }

  private async findMemberRole(
    workspaceId: string,
    email: string,
  ): Promise<ColabauthMemberRole | null> {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
      relations: { userWorkspaces: true },
    });
    const userWorkspace = user?.userWorkspaces.find(
      (candidate) => candidate.workspaceId === workspaceId,
    );

    if (!isDefined(userWorkspace)) {
      return null;
    }

    const roleByUserWorkspaceId =
      await this.getRoleByUserWorkspaceId(workspaceId);

    return roleByUserWorkspaceId.get(userWorkspace.id) ?? 'member';
  }

  private async getRoleByUserWorkspaceId(
    workspaceId: string,
  ): Promise<Map<string, ColabauthMemberRole>> {
    const adminRole = await this.roleRepository.findOne(workspaceId, {
      where: { universalIdentifier: STANDARD_ROLE.admin.universalIdentifier },
    });
    const { userWorkspaceRoleMap } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'userWorkspaceRoleMap',
      ]);

    return new Map(
      Object.entries(userWorkspaceRoleMap).map(([userWorkspaceId, roleId]) => [
        userWorkspaceId,
        roleId === adminRole?.id ? 'admin' : 'member',
      ]),
    );
  }

  private toStatus(status: WorkspaceActivationStatus): ColabauthTenantStatus {
    if (PENDING_STATUSES.includes(status)) {
      return 'pending';
    }

    if (status === WorkspaceActivationStatus.SUSPENDED) {
      return 'suspended';
    }

    return status === WorkspaceActivationStatus.INACTIVE
      ? 'inactive'
      : 'active';
  }

  private async findWorkspaceOrThrow(
    workspaceId: string,
  ): Promise<WorkspaceEntity> {
    const workspace = await this.workspaceRepository.findOneBy({
      id: workspaceId,
    });

    if (!isDefined(workspace)) {
      throw new NotFoundException('Tenant not found');
    }

    return workspace;
  }

  private async findWorkspaceIdForOrganization(
    workosOrganizationId: string,
  ): Promise<string | null> {
    const link = await this.keyValuePairRepository
      .createQueryBuilder('keyValuePair')
      .where('keyValuePair.key = :key', { key: WORKOS_ORGANIZATION_LINK_KEY })
      .andWhere('keyValuePair.workspaceId IS NOT NULL')
      .andWhere('keyValuePair.userId IS NULL')
      .andWhere(
        'keyValuePair.value = to_jsonb(CAST(:organizationId AS text))',
        {
          organizationId: workosOrganizationId,
        },
      )
      .getOne();

    return link?.workspaceId ?? null;
  }

  private async findOrganizationIdForWorkspace(
    workspaceId: string,
  ): Promise<string | null> {
    const link = await this.keyValuePairRepository.findOne({
      where: {
        key: WORKOS_ORGANIZATION_LINK_KEY,
        workspaceId,
        userId: IsNull(),
      },
    });

    return typeof link?.value === 'string' ? link.value : null;
  }
}
