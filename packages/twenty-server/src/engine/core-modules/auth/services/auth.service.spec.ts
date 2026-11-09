import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { hashPassword } from 'src/engine/core-modules/auth/auth.util';
import { AuthService } from 'src/engine/core-modules/auth/services/auth.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceInvitationService } from 'src/engine/core-modules/workspace-invitation/services/workspace-invitation.service';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

describe('AuthService', () => {
  const password = 'Correct-Password1!';
  const workspace = {
    id: 'workspace-id',
    isPasswordAuthEnabled: true,
  } as WorkspaceEntity;
  const invitation = {
    value: 'personal-invite-token',
    context: { email: 'invitee@example.com', roleId: 'admin-role-id' },
  };

  let service: AuthService;
  let userRepository: { findOne: jest.Mock };
  let twentyConfigService: { get: jest.Mock };
  let userWorkspaceService: {
    checkUserWorkspaceExists: jest.Mock;
    addUserToWorkspaceIfUserNotInWorkspace: jest.Mock;
  };
  let workspaceInvitationService: {
    getOneWorkspaceInvitation: jest.Mock;
    validatePersonalInvitation: jest.Mock;
  };

  beforeEach(async () => {
    userRepository = { findOne: jest.fn() };
    twentyConfigService = { get: jest.fn().mockReturnValue(false) };
    userWorkspaceService = {
      checkUserWorkspaceExists: jest.fn().mockResolvedValue(false),
      addUserToWorkspaceIfUserNotInWorkspace: jest.fn(),
    };
    workspaceInvitationService = {
      getOneWorkspaceInvitation: jest.fn().mockResolvedValue(invitation),
      validatePersonalInvitation: jest
        .fn()
        .mockResolvedValue({ isValid: true }),
    };

    const module = await Test.createTestingModule({
      providers: [AuthService],
    })
      .useMocker((token) => {
        if (token === getRepositoryToken(UserEntity)) {
          return userRepository;
        }

        if (token === TwentyConfigService) {
          return twentyConfigService;
        }

        if (token === UserWorkspaceService) {
          return userWorkspaceService;
        }

        return token === WorkspaceInvitationService
          ? workspaceInvitationService
          : {};
      })
      .compile();

    service = module.get(AuthService);
  });

  const mockUser = async (isEmailVerified: boolean) => {
    const user = {
      id: 'user-id',
      email: 'invitee@example.com',
      isEmailVerified,
      passwordHash: await hashPassword(password),
      userWorkspaces: [],
    };

    userRepository.findOne.mockResolvedValue(user);

    return user;
  };

  describe('validateLoginWithPassword', () => {
    it.each([false, true])(
      'does not add an unverified account to an invited workspace when IS_EMAIL_VERIFICATION_REQUIRED is %s',
      async (isEmailVerificationRequired) => {
        twentyConfigService.get.mockReturnValue(isEmailVerificationRequired);
        await mockUser(false);

        await expect(
          service.validateLoginWithPassword(
            { email: 'invitee@example.com', password },
            workspace,
          ),
        ).rejects.toThrow();

        expect(
          userWorkspaceService.addUserToWorkspaceIfUserNotInWorkspace,
        ).not.toHaveBeenCalled();
      },
    );

    it('adds a verified account to the invited workspace with the invitation role', async () => {
      const user = await mockUser(true);

      await expect(
        service.validateLoginWithPassword(
          { email: 'invitee@example.com', password },
          workspace,
        ),
      ).resolves.toBe(user);

      expect(
        userWorkspaceService.addUserToWorkspaceIfUserNotInWorkspace,
      ).toHaveBeenCalledWith(user, workspace, 'admin-role-id');
    });

    it('does not use the invitation when the password is wrong', async () => {
      await mockUser(true);

      await expect(
        service.validateLoginWithPassword(
          { email: 'invitee@example.com', password: 'Wrong-Password1!' },
          workspace,
        ),
      ).rejects.toThrow('Wrong password');

      expect(
        userWorkspaceService.addUserToWorkspaceIfUserNotInWorkspace,
      ).not.toHaveBeenCalled();
    });

    it('still logs in an unverified account that is already a member', async () => {
      const user = await mockUser(false);

      userWorkspaceService.checkUserWorkspaceExists.mockResolvedValue(true);

      await expect(
        service.validateLoginWithPassword(
          { email: 'invitee@example.com', password },
          workspace,
        ),
      ).resolves.toBe(user);
    });
  });

  describe('joinWorkspaceIfInvited', () => {
    it('adds the user with the invitation role', async () => {
      const user = await mockUser(true);

      await service.joinWorkspaceIfInvited({
        user: user as unknown as UserEntity,
        workspace,
      });

      expect(
        userWorkspaceService.addUserToWorkspaceIfUserNotInWorkspace,
      ).toHaveBeenCalledWith(user, workspace, 'admin-role-id');
    });

    it('does nothing without a pending invitation', async () => {
      const user = await mockUser(true);

      workspaceInvitationService.getOneWorkspaceInvitation.mockResolvedValue(
        null,
      );

      await service.joinWorkspaceIfInvited({
        user: user as unknown as UserEntity,
        workspace,
      });

      expect(
        userWorkspaceService.addUserToWorkspaceIfUserNotInWorkspace,
      ).not.toHaveBeenCalled();
    });
  });
});
