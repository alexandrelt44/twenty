import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';

import { WorkspaceActivationStatus } from 'twenty-shared/workspace';

import { AppTokenEntity } from 'src/engine/core-modules/app-token/app-token.entity';
import { AuthSsoService } from 'src/engine/core-modules/auth/services/auth-sso.service';
import { AuthService } from 'src/engine/core-modules/auth/services/auth.service';
import { SignInUpService } from 'src/engine/core-modules/auth/services/sign-in-up.service';
import { WorkspaceAccessSyncService } from 'src/engine/core-modules/auth/services/workspace-access-sync.service';
import { type GoogleRequest } from 'src/engine/core-modules/auth/strategies/google.auth.strategy';
import { LoginTokenService } from 'src/engine/core-modules/auth/token/services/login-token.service';
import { SsoExchangeTokenService } from 'src/engine/core-modules/auth/token/services/sso-exchange-token.service';
import { DomainServerConfigService } from 'src/engine/core-modules/domain/domain-server-config/services/domain-server-config.service';
import { WorkspaceDomainsService } from 'src/engine/core-modules/domain/workspace-domains/services/workspace-domains.service';
import { EnterprisePlanService } from 'src/engine/core-modules/enterprise/services/enterprise-plan.service';
import { EventLogEmitterService } from 'src/engine/core-modules/event-logs/emit/event-log-emitter.service';
import { GuardRedirectService } from 'src/engine/core-modules/guard-redirect/services/guard-redirect.service';
import { MetricsService } from 'src/engine/core-modules/metrics/metrics.service';
import { OnboardingService } from 'src/engine/core-modules/onboarding/onboarding.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceInvitationService } from 'src/engine/core-modules/workspace-invitation/services/workspace-invitation.service';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceEventEmitter } from 'src/engine/workspace-event-emitter/workspace-event-emitter';

const EMAIL = 'outsider@example.com';
const ERROR_URL = 'https://crm.example.com/verify?errorMessage=refused';

const workspace = {
  id: 'workspace-id',
  isGoogleAuthEnabled: true,
  activationStatus: WorkspaceActivationStatus.ACTIVE,
  approvedAccessDomains: [],
  isPublicInviteLinkEnabled: true,
} as unknown as WorkspaceEntity;

const existingUser = {
  id: 'existing-user-id',
  email: EMAIL,
  canAccessFullAdminPanel: false,
} as unknown as UserEntity;

const invitation = {
  value: 'personal-invite-token',
  context: { email: EMAIL, roleId: 'invitation-role-id' },
};

describe('social SSO access', () => {
  let authService: AuthService;
  let signInUpService: SignInUpService;
  let userService: {
    findUserByEmailWithWorkspaces: jest.Mock;
    findUserByEmail: jest.Mock;
    hasUserAccessToWorkspaceOrThrow: jest.Mock;
    markEmailAsVerified: jest.Mock;
  };
  let userRepository: {
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let workspaceRepository: { count: jest.Mock; findOne: jest.Mock };
  let invitationQuery: Record<string, jest.Mock>;
  let workspaceInvitationService: {
    findInvitationsByEmail: jest.Mock;
    validatePersonalInvitation: jest.Mock;
    invalidateWorkspaceInvitation: jest.Mock;
  };
  let userWorkspaceService: {
    findAvailableWorkspacesByEmail: jest.Mock;
    addUserToWorkspaceIfUserNotInWorkspace: jest.Mock;
  };
  let authSsoService: { findWorkspaceFromWorkspaceIdOrAuthProvider: jest.Mock };
  let ssoExchangeTokenService: { generateSsoExchangeToken: jest.Mock };
  let loginTokenService: { generateLoginToken: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let guardRedirectService: {
    getRedirectErrorUrlAndCaptureExceptions: jest.Mock;
  };
  let workspaceAccessSyncService: { grantAccessOnSignIn: jest.Mock };

  beforeEach(async () => {
    const config: Record<string, unknown> = {
      IS_MULTIWORKSPACE_ENABLED: true,
      IS_WORKSPACE_CREATION_LIMITED_TO_SERVER_ADMINS: true,
    };

    userService = {
      findUserByEmailWithWorkspaces: jest.fn().mockResolvedValue(null),
      findUserByEmail: jest.fn().mockResolvedValue(null),
      hasUserAccessToWorkspaceOrThrow: jest
        .fn()
        .mockRejectedValue(new Error('User has no access to this workspace')),
      markEmailAsVerified: jest.fn(),
    };
    userRepository = {
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn((user) => user),
      save: jest.fn(async (user) => ({ ...user, id: 'new-user-id' })),
    };
    workspaceRepository = {
      count: jest.fn().mockResolvedValue(1),
      findOne: jest.fn().mockResolvedValue(null),
    };
    invitationQuery = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    workspaceInvitationService = {
      findInvitationsByEmail: jest.fn().mockResolvedValue([]),
      validatePersonalInvitation: jest
        .fn()
        .mockResolvedValue({ isValid: true, workspace }),
      invalidateWorkspaceInvitation: jest.fn(),
    };
    userWorkspaceService = {
      findAvailableWorkspacesByEmail: jest
        .fn()
        .mockResolvedValue({ availableWorkspacesForSignUp: [] }),
      addUserToWorkspaceIfUserNotInWorkspace: jest.fn(),
    };
    authSsoService = {
      findWorkspaceFromWorkspaceIdOrAuthProvider: jest
        .fn()
        .mockResolvedValue(workspace),
    };
    ssoExchangeTokenService = {
      generateSsoExchangeToken: jest
        .fn()
        .mockResolvedValue({ token: 'exchange-token' }),
    };
    loginTokenService = {
      generateLoginToken: jest.fn().mockResolvedValue({ token: 'login-token' }),
    };
    dataSource = { transaction: jest.fn() };
    guardRedirectService = {
      getRedirectErrorUrlAndCaptureExceptions: jest
        .fn()
        .mockReturnValue(ERROR_URL),
    };

    workspaceAccessSyncService = {
      grantAccessOnSignIn: jest.fn().mockResolvedValue(false),
    };

    const mocksByToken = new Map<unknown, unknown>([
      [WorkspaceAccessSyncService, workspaceAccessSyncService],
      [getRepositoryToken(UserEntity), userRepository],
      [getRepositoryToken(WorkspaceEntity), workspaceRepository],
      [
        getRepositoryToken(AppTokenEntity),
        { createQueryBuilder: () => invitationQuery },
      ],
      [getDataSourceToken(), dataSource],
      [TwentyConfigService, { get: (key: string) => config[key] }],
      [UserService, userService],
      [WorkspaceInvitationService, workspaceInvitationService],
      [UserWorkspaceService, userWorkspaceService],
      [AuthSsoService, authSsoService],
      [SsoExchangeTokenService, ssoExchangeTokenService],
      [LoginTokenService, loginTokenService],
      [GuardRedirectService, guardRedirectService],
      [EnterprisePlanService, { isValid: () => true }],
      [
        WorkspaceDomainsService,
        {
          getSubdomainAndCustomDomainFromWorkspaceFallbackOnDefaultSubdomain:
            jest.fn().mockReturnValue({}),
          buildWorkspaceURL: jest.fn(
            () => new URL('https://workspace.example.com/verify'),
          ),
        },
      ],
      [
        DomainServerConfigService,
        {
          buildBaseUrl: jest.fn(({ hash }: { hash: string }) => {
            const url = new URL('https://crm.example.com/welcome');

            url.hash = hash;

            return url;
          }),
        },
      ],
      [
        OnboardingService,
        {
          setOnboardingConnectAccountPending: jest.fn(),
          setOnboardingCreateProfilePending: jest.fn(),
        },
      ],
      [WorkspaceEventEmitter, { emitCustomBatchEvent: jest.fn() }],
      [
        EventLogEmitterService,
        { createContext: () => ({ insertWorkspaceEvent: jest.fn() }) },
      ],
      [MetricsService, { incrementCounterForEvent: jest.fn() }],
    ]);

    const module = await Test.createTestingModule({
      providers: [AuthService, SignInUpService],
    })
      .useMocker((token) =>
        mocksByToken.has(token)
          ? mocksByToken.get(token)
          : { createOrUpdateSsoConnectedAccount: jest.fn() },
      )
      .compile();

    authService = module.get(AuthService);
    signInUpService = module.get(SignInUpService);
  });

  const signIn = (
    identity: Partial<GoogleRequest['user']> = {},
    directoryUserId?: string,
  ) =>
    authService.signInUpWithSocialSso(
      {
        email: EMAIL,
        picture: null,
        action: 'list-available-workspaces',
        ...identity,
      },
      AuthProviderEnum.Google,
      directoryUserId,
    );

  const expectRefusalReason = (message: string) => {
    expect(
      guardRedirectService.getRedirectErrorUrlAndCaptureExceptions,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message }),
      }),
    );
  };

  const expectNoWorkspaceAccess = () => {
    expect(loginTokenService.generateLoginToken).not.toHaveBeenCalled();
    expect(
      userWorkspaceService.addUserToWorkspaceIfUserNotInWorkspace,
    ).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  };

  describe('without a workspaceId or an invite hash', () => {
    it('refuses a new user who has no invitation or approved domain', async () => {
      await expect(signIn()).rejects.toThrow('New workspace setup is disabled');

      expect(userRepository.save).not.toHaveBeenCalled();
      expect(
        ssoExchangeTokenService.generateSsoExchangeToken,
      ).not.toHaveBeenCalled();
      expectNoWorkspaceAccess();
    });

    it('creates an invited user without adding them to any workspace', async () => {
      workspaceInvitationService.findInvitationsByEmail.mockResolvedValue([
        { workspace },
      ]);

      await expect(signIn()).resolves.toContain(
        'ssoExchangeToken=exchange-token',
      );

      expect(userRepository.save).toHaveBeenCalledTimes(1);
      expectNoWorkspaceAccess();
    });

    it('gives an existing user only the workspace picker', async () => {
      userService.findUserByEmailWithWorkspaces.mockResolvedValue(existingUser);

      await expect(signIn()).resolves.toContain(
        'ssoExchangeToken=exchange-token',
      );

      expect(userRepository.save).not.toHaveBeenCalled();
      expectNoWorkspaceAccess();
    });

    it('does not let a non-admin create a workspace afterwards', async () => {
      await expect(
        signInUpService.signUpOnNewWorkspace(
          { type: 'existingUser', existingUser },
          { displayName: 'Own workspace' },
        ),
      ).rejects.toThrow('Workspace creation is restricted to admins');

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('with the workspaceId of an existing workspace', () => {
    it('refuses a new user who has no invitation', async () => {
      await expect(signIn({ workspaceId: workspace.id })).resolves.toBe(
        ERROR_URL,
      );

      expectRefusalReason('User does not have access to this workspace');
      expect(userRepository.save).not.toHaveBeenCalled();
      expectNoWorkspaceAccess();
    });

    it('refuses an existing user who is not a member', async () => {
      userService.findUserByEmailWithWorkspaces.mockResolvedValue(existingUser);

      await expect(signIn({ workspaceId: workspace.id })).resolves.toBe(
        ERROR_URL,
      );

      expectRefusalReason('User has no access to this workspace');
      expect(userService.hasUserAccessToWorkspaceOrThrow).toHaveBeenCalledWith(
        existingUser.id,
        workspace.id,
      );
      expectNoWorkspaceAccess();
    });

    it('looks the invitation up in that workspace only', async () => {
      await signIn({ workspaceId: workspace.id });

      expect(invitationQuery.where).toHaveBeenCalledWith(
        '"appToken"."workspaceId" = :workspaceId',
        { workspaceId: workspace.id },
      );
      expectNoWorkspaceAccess();
    });

    it('adds an invited user to the workspace with the invitation role', async () => {
      invitationQuery.getOne.mockResolvedValue(invitation);

      await expect(signIn({ workspaceId: workspace.id })).resolves.toContain(
        'https://workspace.example.com/verify',
      );

      expect(
        workspaceInvitationService.validatePersonalInvitation,
      ).toHaveBeenCalledWith({
        workspacePersonalInviteToken: invitation.value,
        email: EMAIL,
      });
      expect(
        userWorkspaceService.addUserToWorkspaceIfUserNotInWorkspace,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ email: EMAIL }),
        workspace,
        'invitation-role-id',
      );
      expect(loginTokenService.generateLoginToken).toHaveBeenCalledWith(
        EMAIL,
        workspace.id,
        AuthProviderEnum.Google,
      );
    });
  });

  describe('with access through a directory organization', () => {
    it('lets a member of the linked organization in without an invitation', async () => {
      workspaceAccessSyncService.grantAccessOnSignIn.mockResolvedValue(true);
      userService.findUserByEmailWithWorkspaces
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingUser);
      userService.hasUserAccessToWorkspaceOrThrow.mockResolvedValue(undefined);

      await expect(
        signIn({ workspaceId: workspace.id }, 'directory-user-id'),
      ).resolves.toContain('https://workspace.example.com/verify');

      expect(
        workspaceAccessSyncService.grantAccessOnSignIn,
      ).toHaveBeenCalledWith({
        directoryUserId: 'directory-user-id',
        workspaceId: workspace.id,
      });
      expect(loginTokenService.generateLoginToken).toHaveBeenCalledWith(
        EMAIL,
        workspace.id,
        AuthProviderEnum.Google,
      );
    });

    it('still refuses someone the directory does not link to the workspace', async () => {
      await expect(
        signIn({ workspaceId: workspace.id }, 'directory-user-id'),
      ).resolves.toBe(ERROR_URL);

      expectRefusalReason('User does not have access to this workspace');
      expectNoWorkspaceAccess();
    });

    it('does not ask the directory when the sign-in has no directory user', async () => {
      await signIn({ workspaceId: workspace.id });

      expect(
        workspaceAccessSyncService.grantAccessOnSignIn,
      ).not.toHaveBeenCalled();
    });

    it('leaves an invitation to the invitation flow', async () => {
      invitationQuery.getOne.mockResolvedValue(invitation);

      await signIn({ workspaceId: workspace.id }, 'directory-user-id');

      expect(
        workspaceAccessSyncService.grantAccessOnSignIn,
      ).not.toHaveBeenCalled();
    });
  });

  it('refuses an invite hash that matches no workspace', async () => {
    await expect(signIn({ workspaceInviteHash: 'unknown-hash' })).resolves.toBe(
      ERROR_URL,
    );

    expectRefusalReason('Workspace creation is restricted to admins');
    expect(userRepository.save).not.toHaveBeenCalled();
    expectNoWorkspaceAccess();
  });
});
