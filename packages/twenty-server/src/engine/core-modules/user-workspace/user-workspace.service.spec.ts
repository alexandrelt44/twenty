import { Test } from '@nestjs/testing';

import { type AppTokenEntity } from 'src/engine/core-modules/app-token/app-token.entity';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

describe('UserWorkspaceService.setLoginTokenToAvailableWorkspacesWhenAuthProviderMatch', () => {
  const invitedWorkspace = { id: 'invited-workspace' } as WorkspaceEntity;
  const approvedDomainWorkspace = {
    id: 'approved-domain-workspace',
  } as WorkspaceEntity;
  const availableWorkspaces = {
    availableWorkspacesForSignIn: [],
    availableWorkspacesForSignUp: [
      { workspace: approvedDomainWorkspace },
      {
        workspace: invitedWorkspace,
        appToken: { value: 'personal-invite-token' } as AppTokenEntity,
      },
    ],
  };

  let service: UserWorkspaceService;
  let twentyConfigService: { get: jest.Mock };

  beforeEach(async () => {
    twentyConfigService = { get: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [UserWorkspaceService],
    })
      .useMocker((token) =>
        token === TwentyConfigService ? twentyConfigService : {},
      )
      .compile();

    service = module.get(UserWorkspaceService);

    jest
      .spyOn(service, 'castWorkspaceToAvailableWorkspace')
      .mockImplementation(async (workspace) => ({ id: workspace.id }) as never);
  });

  const listWorkspacesForSignUp = async (isEmailVerified: boolean) => {
    const { availableWorkspacesForSignUp } =
      await service.setLoginTokenToAvailableWorkspacesWhenAuthProviderMatch(
        availableWorkspaces,
        { email: 'invitee@example.com', isEmailVerified },
        AuthProviderEnum.Password,
      );

    return availableWorkspacesForSignUp;
  };

  it.each([false, true])(
    'does not offer invitations to an unverified account when IS_EMAIL_VERIFICATION_REQUIRED is %s',
    async (isEmailVerificationRequired) => {
      twentyConfigService.get.mockReturnValue(isEmailVerificationRequired);

      const workspaces = await listWorkspacesForSignUp(false);

      expect(workspaces).toEqual([{ id: approvedDomainWorkspace.id }]);
      expect(JSON.stringify(workspaces)).not.toContain('personal-invite-token');
    },
  );

  it('offers invitations with their token to a verified account', async () => {
    twentyConfigService.get.mockReturnValue(false);

    await expect(listWorkspacesForSignUp(true)).resolves.toEqual([
      { id: approvedDomainWorkspace.id },
      { id: invitedWorkspace.id, personalInviteToken: 'personal-invite-token' },
    ]);
  });
});
