import { WorkspaceActivationStatus } from 'twenty-shared/workspace';

import { ColabauthTenantService } from 'src/engine/core-modules/colabauth/services/colabauth-tenant.service';

const WORKSPACE_ID = '20202020-0000-4000-8000-000000000001';
const ORGANIZATION_ID = 'org_cliente';
const DIRECTORY_USER_ID = 'user_dir_1';
const ADMIN_ROLE_ID = 'role-admin';

const directoryUser = {
  id: DIRECTORY_USER_ID,
  email: 'pessoa@cliente.example',
  firstName: 'Pessoa',
  lastName: 'Teste',
  isEmailVerified: true,
};

type Setup = {
  linkedWorkspaceId?: string | null;
  activationStatus?: WorkspaceActivationStatus;
  workspaceWithSlug?: object | null;
  memberships?: {
    organizationId: string;
    roleSlug: string;
    isActive: boolean;
  }[];
  organizationMembers?: {
    directoryUserId: string;
    roleSlug: string;
    isActive: boolean;
  }[];
  crmMembers?: { id: string; userId?: string; user: { email: string } }[];
  roleMap?: Record<string, string>;
  syncOutcome?: string;
  directoryUserByEmail?: typeof directoryUser | null;
};

const buildService = ({
  linkedWorkspaceId = null,
  activationStatus = WorkspaceActivationStatus.ACTIVE,
  workspaceWithSlug = null,
  memberships = [
    { organizationId: ORGANIZATION_ID, roleSlug: 'admin', isActive: true },
  ],
  organizationMembers = [],
  crmMembers = [],
  roleMap = {},
  syncOutcome = 'unchanged',
  directoryUserByEmail = null,
}: Setup = {}) => {
  const workspace = {
    id: WORKSPACE_ID,
    subdomain: 'cliente',
    displayName: 'Cliente',
    activationStatus,
    workspaceCustomApplicationId: 'app-1',
  };
  let linkedWorkspace = linkedWorkspaceId;

  const savedEntities: unknown[] = [];
  const dataSource = {
    transaction: jest.fn(async (run: (manager: unknown) => Promise<void>) => {
      await run({
        queryRunner: {
          manager: {
            save: jest.fn(async (_entity: unknown, value: unknown) => {
              savedEntities.push(value);

              return value;
            }),
          },
        },
      });
      linkedWorkspace = WORKSPACE_ID;
    }),
  };
  const workspaceRepository = {
    findOne: jest.fn(async () => workspaceWithSlug),
    findOneBy: jest.fn(async () => workspace),
    create: jest.fn((value: object) => value),
  };
  const userRepository = {
    findOne: jest.fn(async () => null),
    create: jest.fn((value: object) => value),
    save: jest.fn(async (value: object) => ({
      id: 'crm-user-1',
      locale: 'en',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...value,
    })),
  };
  const userWorkspaceRepository = {
    find: jest.fn(async () => crmMembers),
  };
  const keyValuePairRepository = {
    create: jest.fn((value: object) => value),
    findOne: jest.fn(async () => ({ value: ORGANIZATION_ID })),
    createQueryBuilder: jest.fn(() => {
      const builder = {
        where: () => builder,
        andWhere: () => builder,
        getOne: async () =>
          linkedWorkspace === null ? null : { workspaceId: linkedWorkspace },
      };

      return builder;
    }),
  };
  const applicationService = {
    createWorkspaceCustomApplication: jest.fn(),
    findById: jest.fn(async () => ({ universalIdentifier: 'app-uid' })),
  };
  const workspaceService = {
    activateWorkspace: jest.fn(),
    suspendWorkspace: jest.fn(),
    reactivateWorkspace: jest.fn(),
  };
  const userWorkspaceService = { create: jest.fn() };
  const workspaceAccessSyncService = {
    syncMembership: jest.fn(async () => syncOutcome),
  };
  const directory = {
    findUser: jest.fn(async () => directoryUser),
    findUserByEmail: jest.fn(async () => directoryUserByEmail),
    listMemberships: jest.fn(async () => memberships),
    listOrganizationMembers: jest.fn(async () => organizationMembers),
    findWorkspaceIdForOrganization: jest.fn(async () => null),
  };

  const service = new ColabauthTenantService(
    dataSource as never,
    workspaceRepository as never,
    userRepository as never,
    userWorkspaceRepository as never,
    keyValuePairRepository as never,
    { findOne: jest.fn(async () => ({ id: ADMIN_ROLE_ID })) } as never,
    applicationService as never,
    workspaceService as never,
    {
      getWorkspaceUrls: () => ({ subdomainUrl: 'https://cliente.crm.test' }),
    } as never,
    { validateSubdomainOrThrow: jest.fn() } as never,
    userWorkspaceService as never,
    workspaceAccessSyncService as never,
    directory as never,
    {
      getOrRecompute: jest.fn(async () => ({ userWorkspaceRoleMap: roleMap })),
    } as never,
  );

  return {
    service,
    dataSource,
    savedEntities,
    userRepository,
    userWorkspaceService,
    workspaceService,
    workspaceAccessSyncService,
  };
};

describe('ColabauthTenantService', () => {
  describe('createTenant', () => {
    const input = {
      name: 'Cliente',
      slug: 'cliente',
      workosOrganizationId: ORGANIZATION_ID,
    };

    it('creates an empty pending workspace linked to the organization', async () => {
      const { service, savedEntities } = buildService({
        activationStatus: WorkspaceActivationStatus.PENDING_CREATION,
      });

      const { created, tenant } = await service.createTenant(input);

      expect(created).toBe(true);
      expect(tenant).toMatchObject({
        id: WORKSPACE_ID,
        slug: 'cliente',
        status: 'pending',
        workosOrganizationId: ORGANIZATION_ID,
        members: [],
      });
      expect(savedEntities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            subdomain: 'cliente',
            activationStatus: WorkspaceActivationStatus.PENDING_CREATION,
          }),
          expect.objectContaining({ value: ORGANIZATION_ID }),
        ]),
      );
    });

    it('returns the existing tenant when the organization already has one', async () => {
      const { service, dataSource } = buildService({
        linkedWorkspaceId: WORKSPACE_ID,
      });

      const { created, tenant } = await service.createTenant(input);

      expect(created).toBe(false);
      expect(tenant.id).toBe(WORKSPACE_ID);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('refuses a slug that belongs to another tenant', async () => {
      const { service, dataSource } = buildService({
        workspaceWithSlug: { id: 'other' },
      });

      await expect(service.createTenant(input)).rejects.toMatchObject({
        status: 409,
      });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('syncMembership', () => {
    it('activates a pending workspace with its first member, who becomes Admin', async () => {
      const {
        service,
        userRepository,
        userWorkspaceService,
        workspaceService,
      } = buildService({
        linkedWorkspaceId: WORKSPACE_ID,
        activationStatus: WorkspaceActivationStatus.PENDING_CREATION,
        roleMap: { 'uw-1': ADMIN_ROLE_ID },
      });

      userRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'crm-user-1',
        userWorkspaces: [{ id: 'uw-1', workspaceId: WORKSPACE_ID }],
      } as never);

      expect(
        await service.syncMembership({
          workosUserId: DIRECTORY_USER_ID,
          workosOrganizationId: ORGANIZATION_ID,
        }),
      ).toEqual({ action: 'created', role: 'admin' });
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: directoryUser.email }),
      );
      expect(userWorkspaceService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: WORKSPACE_ID,
          applicationUniversalIdentifier: 'app-uid',
        }),
      );
      expect(workspaceService.activateWorkspace).toHaveBeenCalled();
    });

    it('leaves activation to the member who already started it', async () => {
      const { service, userWorkspaceService, workspaceService } = buildService({
        linkedWorkspaceId: WORKSPACE_ID,
        activationStatus: WorkspaceActivationStatus.PENDING_CREATION,
        crmMembers: [
          { id: 'uw-0', userId: 'crm-user-0', user: { email: 'a@x.test' } },
        ],
      });

      expect(
        await service.syncMembership({
          workosUserId: DIRECTORY_USER_ID,
          workosOrganizationId: ORGANIZATION_ID,
        }),
      ).toEqual({ action: 'noop', role: null });
      expect(userWorkspaceService.create).not.toHaveBeenCalled();
      expect(workspaceService.activateWorkspace).not.toHaveBeenCalled();
    });

    it('does not activate a pending workspace for someone outside the organization', async () => {
      const { service, workspaceService } = buildService({
        linkedWorkspaceId: WORKSPACE_ID,
        activationStatus: WorkspaceActivationStatus.PENDING_CREATION,
        memberships: [],
      });

      expect(
        await service.syncMembership({
          workosUserId: DIRECTORY_USER_ID,
          workosOrganizationId: ORGANIZATION_ID,
        }),
      ).toEqual({ action: 'noop', role: null });
      expect(workspaceService.activateWorkspace).not.toHaveBeenCalled();
    });

    it.each([
      ['added', 'created'],
      ['role-updated', 'updated'],
      ['removed', 'removed'],
      ['unchanged', 'noop'],
      ['kept-last-admin', 'noop'],
    ])(
      'reports the %s outcome of an active workspace as %s',
      async (syncOutcome, action) => {
        const { service, workspaceAccessSyncService } = buildService({
          linkedWorkspaceId: WORKSPACE_ID,
          syncOutcome,
        });

        const result = await service.syncMembership({
          workosUserId: DIRECTORY_USER_ID,
          workosOrganizationId: ORGANIZATION_ID,
        });

        expect(result.action).toBe(action);
        expect(workspaceAccessSyncService.syncMembership).toHaveBeenCalledWith({
          directoryUserId: DIRECTORY_USER_ID,
          organizationId: ORGANIZATION_ID,
          workspaceId: WORKSPACE_ID,
        });
      },
    );

    it('does nothing for an organization without a tenant', async () => {
      const { service, workspaceAccessSyncService } = buildService();

      expect(
        await service.syncMembership({
          workosUserId: DIRECTORY_USER_ID,
          workosOrganizationId: ORGANIZATION_ID,
        }),
      ).toEqual({ action: 'noop', role: null });
      expect(workspaceAccessSyncService.syncMembership).not.toHaveBeenCalled();
    });
  });

  describe('syncTenant', () => {
    it('syncs every organization member and leaves CRM members without a WorkOS account alone', async () => {
      const { service, workspaceAccessSyncService } = buildService({
        linkedWorkspaceId: WORKSPACE_ID,
        syncOutcome: 'added',
        organizationMembers: [
          {
            directoryUserId: DIRECTORY_USER_ID,
            roleSlug: 'member',
            isActive: true,
          },
        ],
        crmMembers: [
          { id: 'uw-1', user: { email: 'pessoa@cliente.example' } },
          { id: 'uw-2', user: { email: 'antiga@cliente.example' } },
        ],
      });

      expect(await service.syncTenant(WORKSPACE_ID)).toEqual({
        results: [
          {
            workosUserId: DIRECTORY_USER_ID,
            email: 'pessoa@cliente.example',
            action: 'created',
          },
          {
            workosUserId: null,
            email: 'antiga@cliente.example',
            action: 'unmanaged',
          },
        ],
      });
      expect(workspaceAccessSyncService.syncMembership).toHaveBeenCalledTimes(
        1,
      );
    });
  });
});
