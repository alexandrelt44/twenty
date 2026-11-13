import {
  type DirectoryMembership,
  type DirectoryUser,
  type WorkspaceAccessDirectory,
} from 'src/engine/core-modules/auth/services/workspace-access-directory';
import { WorkspaceAccessSyncService } from 'src/engine/core-modules/auth/services/workspace-access-sync.service';

const WORKSPACE_ID = 'workspace-1';
const ORGANIZATION_ID = 'org_1';
const DIRECTORY_USER_ID = 'user_dir_1';
const ADMIN_ROLE_ID = 'role-admin';
const DEFAULT_ROLE_ID = 'role-member';

const directoryUser: DirectoryUser = {
  id: DIRECTORY_USER_ID,
  email: 'pessoa@cliente.example',
  firstName: 'Pessoa',
  lastName: 'Teste',
  isEmailVerified: true,
};

const workspace = {
  id: WORKSPACE_ID,
  defaultRoleId: DEFAULT_ROLE_ID,
  activationStatus: 'ACTIVE',
};

type Setup = {
  linkedWorkspaceId?: string | null;
  memberships?: DirectoryMembership[];
  user?: DirectoryUser | null;
  crmUser?: {
    id: string;
    userWorkspaces: { id: string; workspaceId: string }[];
  } | null;
  memberCount?: number;
  roleMap?: Record<string, string>;
  activationStatus?: string;
};

const buildService = ({
  linkedWorkspaceId = WORKSPACE_ID,
  memberships = [
    { organizationId: ORGANIZATION_ID, roleSlug: 'member', isActive: true },
  ],
  user = directoryUser,
  crmUser = null,
  memberCount = 3,
  roleMap = {},
  activationStatus = 'ACTIVE',
}: Setup = {}) => {
  const directory: WorkspaceAccessDirectory = {
    isEnabled: () => true,
    findUser: jest.fn(async () => user),
    listMemberships: jest.fn(async () => memberships),
    findWorkspaceIdForOrganization: jest.fn(async () => linkedWorkspaceId),
    findUserByEmail: jest.fn(async () => user),
    listOrganizationMembers: jest.fn(async () => []),
  };
  const signInUpService = { signInUp: jest.fn() };
  const userWorkspaceService = {
    addUserToWorkspaceIfUserNotInWorkspace: jest.fn(),
  };
  const userService = {
    deleteUserWorkspaceAndPotentiallyDeleteUser: jest.fn(),
  };
  const userRoleService = { assignRoleToManyUserWorkspace: jest.fn() };

  const service = new WorkspaceAccessSyncService(
    directory,
    {
      findOneBy: jest.fn(async () => ({ ...workspace, activationStatus })),
    } as never,
    { findOne: jest.fn(async () => crmUser) } as never,
    { count: jest.fn(async () => memberCount) } as never,
    { findOne: jest.fn(async () => ({ id: ADMIN_ROLE_ID })) } as never,
    signInUpService as never,
    userWorkspaceService as never,
    userService as never,
    userRoleService as never,
    {
      getOrRecompute: jest.fn(async () => ({ userWorkspaceRoleMap: roleMap })),
    } as never,
  );

  return {
    service,
    directory,
    signInUpService,
    userWorkspaceService,
    userService,
    userRoleService,
  };
};

const sync = (service: WorkspaceAccessSyncService) =>
  service.syncMembership({
    directoryUserId: DIRECTORY_USER_ID,
    organizationId: ORGANIZATION_ID,
  });

const member = {
  id: 'crm-user-1',
  userWorkspaces: [{ id: 'uw-1', workspaceId: WORKSPACE_ID }],
};

describe('WorkspaceAccessSyncService', () => {
  it('creates the account in the linked workspace when the person joins the organization', async () => {
    const { service, signInUpService } = buildService();

    expect(await sync(service)).toBe('created');
    expect(signInUpService.signInUp).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace,
        roleId: undefined,
        userData: expect.objectContaining({
          newUserWithPicture: expect.objectContaining({
            email: 'pessoa@cliente.example',
            isEmailVerified: true,
          }),
        }),
      }),
    );
  });

  it('gives the Admin role to a directory admin', async () => {
    const { service, signInUpService } = buildService({
      memberships: [
        { organizationId: ORGANIZATION_ID, roleSlug: 'admin', isActive: true },
      ],
    });

    await sync(service);

    expect(signInUpService.signInUp).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: ADMIN_ROLE_ID }),
    );
  });

  it('does not create an account for an unverified email', async () => {
    const { service, signInUpService } = buildService({
      user: { ...directoryUser, isEmailVerified: false },
    });

    expect(await sync(service)).toBe('email-not-verified');
    expect(signInUpService.signInUp).not.toHaveBeenCalled();
  });

  it('adds an existing account that is not yet in the workspace', async () => {
    const { service, userWorkspaceService } = buildService({
      crmUser: { id: 'crm-user-1', userWorkspaces: [] },
    });

    expect(await sync(service)).toBe('added');
    expect(
      userWorkspaceService.addUserToWorkspaceIfUserNotInWorkspace,
    ).toHaveBeenCalled();
  });

  it('changes nothing when the member already has the right role, so repeated events are harmless', async () => {
    const { service, signInUpService, userWorkspaceService, userRoleService } =
      buildService({ crmUser: member, roleMap: { 'uw-1': DEFAULT_ROLE_ID } });

    expect(await sync(service)).toBe('unchanged');
    expect(await sync(service)).toBe('unchanged');
    expect(signInUpService.signInUp).not.toHaveBeenCalled();
    expect(
      userWorkspaceService.addUserToWorkspaceIfUserNotInWorkspace,
    ).not.toHaveBeenCalled();
    expect(
      userRoleService.assignRoleToManyUserWorkspace,
    ).not.toHaveBeenCalled();
  });

  it('promotes a member who became admin in the directory', async () => {
    const { service, userRoleService } = buildService({
      crmUser: member,
      memberships: [
        { organizationId: ORGANIZATION_ID, roleSlug: 'admin', isActive: true },
      ],
      roleMap: { 'uw-1': DEFAULT_ROLE_ID },
    });

    expect(await sync(service)).toBe('role-updated');
    expect(userRoleService.assignRoleToManyUserWorkspace).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      userWorkspaceIds: ['uw-1'],
      roleId: ADMIN_ROLE_ID,
    });
  });

  it('keeps a custom CRM role when the directory role is not admin', async () => {
    const { service, userRoleService } = buildService({
      crmUser: member,
      roleMap: { 'uw-1': 'role-custom' },
    });

    expect(await sync(service)).toBe('unchanged');
    expect(
      userRoleService.assignRoleToManyUserWorkspace,
    ).not.toHaveBeenCalled();
  });

  it('demotes an admin who is no longer admin in the directory, unless they are the last one', async () => {
    const demoted = buildService({
      crmUser: member,
      roleMap: { 'uw-1': ADMIN_ROLE_ID, 'uw-2': ADMIN_ROLE_ID },
    });

    expect(await sync(demoted.service)).toBe('role-updated');
    expect(
      demoted.userRoleService.assignRoleToManyUserWorkspace,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: DEFAULT_ROLE_ID }),
    );

    const lastAdmin = buildService({
      crmUser: member,
      roleMap: { 'uw-1': ADMIN_ROLE_ID, 'uw-2': DEFAULT_ROLE_ID },
    });

    expect(await sync(lastAdmin.service)).toBe('kept-last-admin');
    expect(
      lastAdmin.userRoleService.assignRoleToManyUserWorkspace,
    ).not.toHaveBeenCalled();
  });

  it('removes the member who left the organization', async () => {
    const { service, userService } = buildService({
      crmUser: member,
      memberships: [],
      roleMap: { 'uw-1': DEFAULT_ROLE_ID },
    });

    expect(await sync(service)).toBe('removed');
    expect(
      userService.deleteUserWorkspaceAndPotentiallyDeleteUser,
    ).toHaveBeenCalledWith({ userId: 'crm-user-1', workspaceId: WORKSPACE_ID });
  });

  it('treats an inactive membership as gone', async () => {
    const { service } = buildService({
      crmUser: member,
      memberships: [
        {
          organizationId: ORGANIZATION_ID,
          roleSlug: 'member',
          isActive: false,
        },
      ],
      roleMap: { 'uw-1': DEFAULT_ROLE_ID },
    });

    expect(await sync(service)).toBe('removed');
  });

  it('never removes the last member or the last admin of a workspace', async () => {
    const lastMember = buildService({
      crmUser: member,
      memberships: [],
      memberCount: 1,
    });

    expect(await sync(lastMember.service)).toBe('kept-last-member');

    const lastAdmin = buildService({
      crmUser: member,
      memberships: [],
      roleMap: { 'uw-1': ADMIN_ROLE_ID, 'uw-2': DEFAULT_ROLE_ID },
    });

    expect(await sync(lastAdmin.service)).toBe('kept-last-admin');
    expect(
      lastAdmin.userService.deleteUserWorkspaceAndPotentiallyDeleteUser,
    ).not.toHaveBeenCalled();
  });

  it('leaves a workspace that is still waiting for its first member to the tenant flow', async () => {
    const { service, signInUpService } = buildService({
      activationStatus: 'PENDING_CREATION',
    });

    expect(await sync(service)).toBe('workspace-pending');
    expect(signInUpService.signInUp).not.toHaveBeenCalled();
  });

  it('uses the workspace given by the caller instead of asking the directory', async () => {
    const { service, directory } = buildService({ linkedWorkspaceId: null });

    expect(
      await service.syncMembership({
        directoryUserId: DIRECTORY_USER_ID,
        organizationId: ORGANIZATION_ID,
        workspaceId: WORKSPACE_ID,
      }),
    ).toBe('created');
    expect(directory.findWorkspaceIdForOrganization).not.toHaveBeenCalled();
  });

  describe('findSingleWorkspaceForSignIn', () => {
    it('returns the active workspace linked to the only organization', async () => {
      const { service } = buildService();

      expect(
        await service.findSingleWorkspaceForSignIn(DIRECTORY_USER_ID),
      ).toBe(WORKSPACE_ID);
    });

    it('returns nothing when the organizations point to several workspaces', async () => {
      const { service, directory } = buildService({
        memberships: [
          { organizationId: 'org_a', roleSlug: 'member', isActive: true },
          { organizationId: 'org_b', roleSlug: 'member', isActive: true },
        ],
      });

      (directory.findWorkspaceIdForOrganization as jest.Mock)
        .mockResolvedValueOnce('workspace-a')
        .mockResolvedValueOnce('workspace-b');

      expect(
        await service.findSingleWorkspaceForSignIn(DIRECTORY_USER_ID),
      ).toBeNull();
    });

    it('returns nothing for a workspace that is not active yet', async () => {
      const { service } = buildService({
        activationStatus: 'PENDING_CREATION',
      });

      expect(
        await service.findSingleWorkspaceForSignIn(DIRECTORY_USER_ID),
      ).toBeNull();
    });

    it('ignores inactive memberships', async () => {
      const { service } = buildService({
        memberships: [
          {
            organizationId: ORGANIZATION_ID,
            roleSlug: 'member',
            isActive: false,
          },
        ],
      });

      expect(
        await service.findSingleWorkspaceForSignIn(DIRECTORY_USER_ID),
      ).toBeNull();
    });
  });

  it('ignores organizations that are not linked to a workspace', async () => {
    const { service, signInUpService } = buildService({
      linkedWorkspaceId: null,
    });

    expect(await sync(service)).toBe('not-linked');
    expect(signInUpService.signInUp).not.toHaveBeenCalled();
  });

  it("grants access on sign-in only for the workspace linked to one of the person's organizations", async () => {
    const linked = buildService();

    expect(
      await linked.service.grantAccessOnSignIn({
        directoryUserId: DIRECTORY_USER_ID,
        workspaceId: WORKSPACE_ID,
      }),
    ).toBe(true);

    const other = buildService();

    expect(
      await other.service.grantAccessOnSignIn({
        directoryUserId: DIRECTORY_USER_ID,
        workspaceId: 'another-workspace',
      }),
    ).toBe(false);
    expect(other.signInUpService.signInUp).not.toHaveBeenCalled();
  });
});
