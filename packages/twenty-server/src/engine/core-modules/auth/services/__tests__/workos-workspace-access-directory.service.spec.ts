import { WorkosWorkspaceAccessDirectoryService } from 'src/engine/core-modules/auth/services/workos-workspace-access-directory.service';

const buildDirectory = (apiKey: string | null = 'sk_test') =>
  new WorkosWorkspaceAccessDirectoryService({
    get: (key: string) => (key === 'WORKOS_API_KEY' ? apiKey : undefined),
  } as never);

const respond = (status: number, body: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response;

describe('WorkosWorkspaceAccessDirectoryService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as never;
  });

  it('is enabled only with an API key', () => {
    expect(buildDirectory().isEnabled()).toBe(true);
    expect(buildDirectory('').isEnabled()).toBe(false);
    expect(buildDirectory(null).isEnabled()).toBe(false);
  });

  it('reads the workspace linked to an organization from its metadata', async () => {
    fetchMock.mockResolvedValue(
      respond(200, {
        metadata: {
          colabcrm_workspace_id: 'workspace-1',
          colabcal_org_id: '1',
        },
      }),
    );

    expect(await buildDirectory().findWorkspaceIdForOrganization('org_1')).toBe(
      'workspace-1',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.workos.com/organizations/org_1',
      expect.objectContaining({ headers: { Authorization: 'Bearer sk_test' } }),
    );
  });

  it('returns no workspace for an organization without the CRM key', async () => {
    fetchMock.mockResolvedValue(
      respond(200, { metadata: { colabcal_org_id: '1' } }),
    );

    expect(
      await buildDirectory().findWorkspaceIdForOrganization('org_1'),
    ).toBeNull();
  });

  it('maps memberships, keeping only active ones as active', async () => {
    fetchMock.mockResolvedValue(
      respond(200, {
        data: [
          {
            organization_id: 'org_1',
            status: 'active',
            role: { slug: 'admin' },
          },
          {
            organization_id: 'org_2',
            status: 'inactive',
            role: { slug: 'member' },
          },
        ],
      }),
    );

    expect(await buildDirectory().listMemberships('user_1')).toEqual([
      { organizationId: 'org_1', roleSlug: 'admin', isActive: true },
      { organizationId: 'org_2', roleSlug: 'member', isActive: false },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.workos.com/user_management/organization_memberships?user_id=user_1&limit=100',
    );
  });

  it('lowercases the email and returns null for an unknown user', async () => {
    fetchMock.mockResolvedValueOnce(
      respond(200, {
        id: 'user_1',
        email: 'Pessoa@Cliente.example',
        first_name: 'Pessoa',
        last_name: null,
        email_verified: true,
      }),
    );

    expect(await buildDirectory().findUser('user_1')).toEqual({
      id: 'user_1',
      email: 'pessoa@cliente.example',
      firstName: 'Pessoa',
      lastName: null,
      isEmailVerified: true,
    });

    fetchMock.mockResolvedValueOnce(respond(404, {}));

    expect(await buildDirectory().findUser('missing')).toBeNull();
  });

  it('fails on other API errors so the webhook is retried', async () => {
    fetchMock.mockResolvedValue(respond(500, {}));

    await expect(buildDirectory().listMemberships('user_1')).rejects.toThrow(
      'WorkOS request failed with status 500',
    );
  });
});
