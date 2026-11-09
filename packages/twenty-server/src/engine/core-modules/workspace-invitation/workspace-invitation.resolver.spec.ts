import { PermissionFlagType } from 'twenty-shared/constants';

import { type AuthContextUser } from 'src/engine/core-modules/auth/types/auth-context.type';
import { type SendInvitationsInput } from 'src/engine/core-modules/workspace-invitation/dtos/send-invitations.input';
import { type WorkspaceInvitationService } from 'src/engine/core-modules/workspace-invitation/services/workspace-invitation.service';
import { WorkspaceInvitationResolver } from 'src/engine/core-modules/workspace-invitation/workspace-invitation.resolver';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { PermissionsExceptionCode } from 'src/engine/metadata-modules/permissions/permissions.exception';
import { type PermissionsService } from 'src/engine/metadata-modules/permissions/permissions.service';
import { type WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';

describe('WorkspaceInvitationResolver.sendInvitations', () => {
  const workspace = { id: 'workspace-id' } as WorkspaceEntity;
  const user = { id: 'user-id' } as AuthContextUser;
  const workspaceMember = { id: 'workspace-member-id' };
  const userWorkspaceId = 'user-workspace-id';

  let resolver: WorkspaceInvitationResolver;
  let sendInvitations: jest.Mock;
  let userHasWorkspaceSettingPermission: jest.Mock;

  beforeEach(() => {
    sendInvitations = jest.fn().mockResolvedValue({ success: true });
    userHasWorkspaceSettingPermission = jest.fn();

    resolver = new WorkspaceInvitationResolver(
      {
        executeInWorkspaceContext: jest.fn((callback) => callback()),
        getRepository: jest.fn(() => ({
          findOneOrFail: jest.fn().mockResolvedValue(workspaceMember),
        })),
      } as unknown as WorkspaceOrmManager,
      { sendInvitations } as unknown as WorkspaceInvitationService,
      {
        userHasWorkspaceSettingPermission,
      } as unknown as PermissionsService,
    );
  });

  const send = (input: Partial<SendInvitationsInput>) =>
    resolver.sendInvitations(
      { emails: ['invitee@example.com'], ...input } as SendInvitationsInput,
      user,
      workspace,
      userWorkspaceId,
      undefined,
    );

  it('rejects a roleId when the caller lacks the ROLES permission', async () => {
    userHasWorkspaceSettingPermission.mockResolvedValue(false);

    await expect(send({ roleId: 'admin-role-id' })).rejects.toMatchObject({
      code: PermissionsExceptionCode.PERMISSION_DENIED,
    });

    expect(userHasWorkspaceSettingPermission).toHaveBeenCalledWith({
      userWorkspaceId,
      workspaceId: workspace.id,
      setting: PermissionFlagType.ROLES,
      applicationId: undefined,
    });
    expect(sendInvitations).not.toHaveBeenCalled();
  });

  it('accepts a roleId when the caller has the ROLES permission', async () => {
    userHasWorkspaceSettingPermission.mockResolvedValue(true);

    await send({ roleId: 'admin-role-id' });

    expect(sendInvitations).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: 'admin-role-id' }),
    );
  });

  it('does not require the ROLES permission without a roleId', async () => {
    await send({});

    expect(userHasWorkspaceSettingPermission).not.toHaveBeenCalled();
    expect(sendInvitations).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: undefined }),
    );
  });
});
