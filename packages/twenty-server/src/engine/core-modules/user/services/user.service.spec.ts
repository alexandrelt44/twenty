import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { CoreEntityCacheService } from 'src/engine/core-entity-cache/services/core-entity-cache.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { type AuthContextUser } from 'src/engine/core-modules/auth/types/auth-context.type';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

describe('UserService.updateUserEmail', () => {
  const user = {
    id: 'user-id',
    email: 'attacker@example.com',
    isEmailVerified: true,
  };

  let service: UserService;
  let userRepository: { findOne: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    const module = await Test.createTestingModule({
      providers: [UserService],
    })
      .useMocker((token) => {
        if (token === getRepositoryToken(UserEntity)) {
          return userRepository;
        }

        if (token === TwentyConfigService) {
          return { get: jest.fn().mockReturnValue(false) };
        }

        if (token === UserWorkspaceService) {
          return { countUserWorkspaces: jest.fn().mockResolvedValue(1) };
        }

        if (token === CoreEntityCacheService) {
          return { invalidate: jest.fn() };
        }

        return {};
      })
      .compile();

    service = module.get(UserService);

    jest
      .spyOn(service, 'findUserByIdOrThrow')
      .mockResolvedValue({ ...user } as UserEntity);
    jest
      .spyOn(service, 'enqueueWorkspaceMemberEmailUpdate')
      .mockResolvedValue();
  });

  it('treats the new address as unverified when no verification email is sent', async () => {
    await service.updateUserEmail({
      user: user as AuthContextUser,
      workspace: { id: 'workspace-id' } as WorkspaceEntity,
      newEmail: 'invitee@example.com',
    });

    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'invitee@example.com',
        isEmailVerified: false,
      }),
    );
  });
});
