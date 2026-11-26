import { generateKeyPairSync, randomUUID } from 'crypto';

import { sign } from 'jsonwebtoken';
import { WorkspaceActivationStatus } from 'twenty-shared/workspace';

import {
  ColabosJwtBearerGrantService,
  RELEASE_INSTALL_LOCK_SCRIPT,
} from 'src/engine/core-modules/application/application-oauth/colabos-jwt-bearer/colabos-jwt-bearer-grant.service';

// Every collaborator is a test double below; mocking the modules keeps the
// spec from loading their whole dependency graph.
jest.mock(
  'src/engine/core-modules/application/application-oauth/oauth.service',
  () => ({ OAuthService: class {} }),
);
jest.mock(
  'src/engine/core-modules/auth/token/services/application-token.service',
  () => ({ ApplicationTokenService: class {} }),
);
jest.mock(
  'src/engine/core-modules/application/application-authorization/services/application-authorization.service',
  () => ({ ApplicationAuthorizationService: class {} }),
);
jest.mock(
  'src/engine/core-modules/application/application-registration/application-registration.service',
  () => ({ ApplicationRegistrationService: class {} }),
);

const SERVER_URL = 'https://crm.example.test';
const CLIENT_ID = 'client_colabos';
const KID = 'colabauth-2026-11';
const WORKSPACE_ID = '20202020-0000-4000-8000-000000000001';
const OTHER_WORKSPACE_ID = '20202020-0000-4000-8000-000000000002';
const DIRECTORY_USER_ID = 'user_01WORKOS';
const EMAIL = 'pessoa@example.test';

const ecKeys = () =>
  generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

const current = ecKeys();
const rotated = ecKeys();
const stranger = ecKeys();

type Claims = Record<string, unknown>;

const buildAssertion = (
  claims: Claims = {},
  {
    key = current.privateKey,
    kid = KID,
    lifetimeSeconds = 120,
  }: { key?: string; kid?: string; lifetimeSeconds?: number } = {},
) => {
  const now = Math.floor(Date.now() / 1000);

  return sign(
    {
      iss: 'colabauth',
      aud: SERVER_URL,
      sub: DIRECTORY_USER_ID,
      workspace_id: WORKSPACE_ID,
      iat: now,
      exp: now + lifetimeSeconds,
      jti: randomUUID(),
      ...claims,
    },
    key,
    { algorithm: 'ES256', keyid: kid },
  );
};

const setup = (configOverrides: Record<string, unknown> = {}) => {
  const config: Record<string, unknown> = {
    SERVER_URL: `${SERVER_URL}/`,
    COLABOS_OAUTH_CLIENT_ID: CLIENT_ID,
    COLABOS_ASSERTION_PUBLIC_KEYS: JSON.stringify({
      [KID]: current.publicKey,
      'colabauth-2027-01': rotated.publicKey,
    }),
    COLABOS_JWT_BEARER_ALLOW_PROXIED: false,
    APPLICATION_ACCESS_TOKEN_EXPIRES_IN: '30m',
    ...configOverrides,
  };

  const usedJtis = new Set<string>();
  const locks = new Map<string, string>();

  const registration = {
    id: 'registration-1',
    oAuthScopes: ['api', 'profile'],
  };
  const application = { id: 'application-1' };
  const user = { id: 'crm-user-1', email: EMAIL };
  const userWorkspace = { id: 'user-workspace-1' };

  const mocks = {
    applicationRegistrationService: {
      findOneByClientId: jest.fn(async (clientId: string) =>
        clientId === CLIENT_ID ? registration : null,
      ),
    },
    applicationAuthorizationService: {
      recordAuthorization: jest.fn(async () => undefined),
    },
    applicationTokenService: {
      generateApplicationTokenPair: jest.fn(async () => ({
        applicationAccessToken: { token: 'access.jwt' },
        applicationRefreshToken: { token: 'refresh.jwt' },
      })),
    },
    oauthService: {
      findOrInstallApplication: jest.fn(async () => application),
    },
    directory: {
      isEnabled: jest.fn(() => true),
      findUser: jest.fn(async (id: string) =>
        id === DIRECTORY_USER_ID
          ? {
              id,
              email: EMAIL,
              firstName: null,
              lastName: null,
              isEmailVerified: true,
            }
          : null,
      ),
    },
    userRepository: {
      findOne: jest.fn(async ({ where }: { where: { email: string } }) =>
        where.email === EMAIL ? user : null,
      ),
    },
    userWorkspaceRepository: {
      findOne: jest.fn(
        async ({ where }: { where: { userId: string; workspaceId: string } }) =>
          where.userId === user.id && where.workspaceId === WORKSPACE_ID
            ? userWorkspace
            : null,
      ),
    },
    workspaceRepository: {
      findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
        [WORKSPACE_ID, OTHER_WORKSPACE_ID].includes(where.id)
          ? { id: where.id, activationStatus: WorkspaceActivationStatus.ACTIVE }
          : null,
      ),
    },
    jtiCache: {
      setIfAbsent: jest.fn(
        async (key: string, _value: unknown, _ttlMs: number) => {
          if (usedJtis.has(key)) return false;
          usedJtis.add(key);

          return true;
        },
      ),
    },
    lockCache: {
      setIfAbsent: jest.fn(
        async (key: string, value: string, _ttlMs: number) => {
          if (locks.has(key)) return false;
          locks.set(key, JSON.stringify(value));

          return true;
        },
      ),
      // Compare-and-delete, like RELEASE_INSTALL_LOCK_SCRIPT.
      runScript: jest.fn(
        async ({ keys, args }: { keys: string[]; args: string[] }) => {
          if (locks.get(keys[0]) !== args[0]) return 0;
          locks.delete(keys[0]);

          return 1;
        },
      ),
    },
  };

  const service = new ColabosJwtBearerGrantService(
    { get: (name: string) => config[name] } as never,
    mocks.applicationRegistrationService as never,
    mocks.applicationAuthorizationService as never,
    mocks.applicationTokenService as never,
    mocks.oauthService as never,
    mocks.directory as never,
    mocks.userRepository as never,
    mocks.userWorkspaceRepository as never,
    mocks.workspaceRepository as never,
    mocks.jtiCache as never,
    mocks.lockCache as never,
  );

  const grant = (
    assertion: string,
    { clientId = CLIENT_ID, isProxied = false } = {},
  ) => service.grant({ assertion, clientId, isProxied });

  return { service, grant, mocks, locks };
};

const expectRefused = (
  result: Awaited<ReturnType<ColabosJwtBearerGrantService['grant']>>,
  error: string,
  status = 400,
) => {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.status).toBe(status);
  expect(result.response.error).toBe(error);
};

describe('ColabosJwtBearerGrantService', () => {
  // The jest config fakes timers globally; this spec signs real JWTs and
  // waits on a real lock, so it needs the real clock.
  beforeEach(() => {
    jest.useRealTimers();
  });

  it('issues a user-context token pair with the application attached', async () => {
    const { grant, mocks } = setup();

    const result = await grant(buildAssertion());

    expect(result).toEqual({
      ok: true,
      response: {
        access_token: 'access.jwt',
        token_type: 'Bearer',
        expires_in: 1800,
        refresh_token: 'refresh.jwt',
        scope: 'api profile',
      },
    });
    expect(
      mocks.applicationTokenService.generateApplicationTokenPair,
    ).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      applicationId: 'application-1',
      userId: 'crm-user-1',
      userWorkspaceId: 'user-workspace-1',
    });
    expect(
      mocks.applicationAuthorizationService.recordAuthorization,
    ).toHaveBeenCalledWith({
      userId: 'crm-user-1',
      workspaceId: WORKSPACE_ID,
      userWorkspaceId: 'user-workspace-1',
      applicationId: 'application-1',
      scopes: ['api', 'profile'],
    });
    // The authorization is recorded before the tokens exist.
    expect(
      mocks.applicationAuthorizationService.recordAuthorization.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      mocks.applicationTokenService.generateApplicationTokenPair.mock
        .invocationCallOrder[0],
    );
  });

  it('accepts every key listed, so a new key can be rolled in', async () => {
    const { grant } = setup();

    const result = await grant(
      buildAssertion({}, { key: rotated.privateKey, kid: 'colabauth-2027-01' }),
    );

    expect(result.ok).toBe(true);
  });

  it('is disabled without a client id or public keys', () => {
    expect(setup().service.isEnabled()).toBe(true);
    expect(setup({ COLABOS_OAUTH_CLIENT_ID: '' }).service.isEnabled()).toBe(
      false,
    );
    expect(
      setup({ COLABOS_ASSERTION_PUBLIC_KEYS: '' }).service.isEnabled(),
    ).toBe(false);
    expect(
      setup({ COLABOS_ASSERTION_PUBLIC_KEYS: 'not json' }).service.isEnabled(),
    ).toBe(false);
  });

  describe('refuses', () => {
    it('a request that came through the reverse proxy', async () => {
      const { grant, mocks } = setup();

      expectRefused(
        await grant(buildAssertion(), { isProxied: true }),
        'unauthorized_client',
        403,
      );
      expect(mocks.jtiCache.setIfAbsent).not.toHaveBeenCalled();
    });

    it('a proxied request only when allowed by configuration', async () => {
      const { grant } = setup({ COLABOS_JWT_BEARER_ALLOW_PROXIED: true });

      expect((await grant(buildAssertion(), { isProxied: true })).ok).toBe(
        true,
      );
    });

    it('another client id', async () => {
      const { grant } = setup();

      expectRefused(
        await grant(buildAssertion(), { clientId: 'client_other' }),
        'unauthorized_client',
        401,
      );
    });

    it('a configured client id that is not registered', async () => {
      const { grant, mocks } = setup();

      mocks.applicationRegistrationService.findOneByClientId.mockResolvedValueOnce(
        null as never,
      );

      expectRefused(await grant(buildAssertion()), 'invalid_client', 401);
    });

    it('a missing assertion', async () => {
      const { grant } = setup();

      expectRefused(await grant(''), 'invalid_request');
    });

    it('an assertion signed by another key', async () => {
      const { grant } = setup();

      expectRefused(
        await grant(buildAssertion({}, { key: stranger.privateKey })),
        'invalid_grant',
      );
    });

    it('an assertion with an unknown kid', async () => {
      const { grant } = setup();

      expectRefused(
        await grant(
          buildAssertion({}, { key: stranger.privateKey, kid: 'unknown' }),
        ),
        'invalid_grant',
      );
    });

    it('an assertion signed with another algorithm', async () => {
      const { grant } = setup();
      const hmac = sign(
        {
          iss: 'colabauth',
          aud: SERVER_URL,
          sub: DIRECTORY_USER_ID,
          workspace_id: WORKSPACE_ID,
          jti: randomUUID(),
        },
        current.publicKey,
        { algorithm: 'HS256', keyid: KID, expiresIn: 60 },
      );

      expectRefused(await grant(hmac), 'invalid_grant');
    });

    it('another audience', async () => {
      const { grant } = setup();

      expectRefused(
        await grant(buildAssertion({ aud: 'https://other.example.test' })),
        'invalid_grant',
      );
    });

    it('another issuer', async () => {
      const { grant } = setup();

      expectRefused(
        await grant(buildAssertion({ iss: 'someone-else' })),
        'invalid_grant',
      );
    });

    it('an expired assertion', async () => {
      const { grant } = setup();
      const past = Math.floor(Date.now() / 1000) - 600;

      expectRefused(
        await grant(buildAssertion({ iat: past, exp: past + 120 })),
        'invalid_grant',
      );
    });

    it('an assertion valid for more than five minutes', async () => {
      const { grant } = setup();

      expectRefused(
        await grant(buildAssertion({}, { lifetimeSeconds: 301 })),
        'invalid_grant',
      );
    });

    it('an assertion issued in the future', async () => {
      const { grant } = setup();
      const future = Math.floor(Date.now() / 1000) + 120;

      expectRefused(
        await grant(buildAssertion({ iat: future, exp: future + 60 })),
        'invalid_grant',
      );
    });

    it('an assertion without jti', async () => {
      const { grant } = setup();

      expectRefused(
        await grant(buildAssertion({ jti: undefined })),
        'invalid_grant',
      );
    });

    it('a replayed jti, even after a successful first use', async () => {
      const { grant } = setup();
      const assertion = buildAssertion();

      expect((await grant(assertion)).ok).toBe(true);
      expectRefused(await grant(assertion), 'invalid_grant');
    });

    it('keeps the jti longer than the assertion can still be accepted', async () => {
      const { grant, mocks } = setup();

      await grant(buildAssertion({}, { lifetimeSeconds: 120 }));

      const ttl = mocks.jtiCache.setIfAbsent.mock.calls[0][2];

      // 120 s of validity plus 30 s of clock tolerance.
      expect(ttl).toBeGreaterThan(150_000);
    });

    it('an assertion without subject or workspace', async () => {
      const { grant } = setup();

      expectRefused(
        await grant(buildAssertion({ sub: undefined })),
        'invalid_grant',
      );
      expectRefused(
        await grant(buildAssertion({ workspace_id: undefined })),
        'invalid_grant',
      );
    });

    it('a workspace that is not active', async () => {
      for (const activationStatus of [
        WorkspaceActivationStatus.PENDING_CREATION,
        WorkspaceActivationStatus.SUSPENDED,
        WorkspaceActivationStatus.INACTIVE,
      ]) {
        const { grant, mocks } = setup();

        mocks.workspaceRepository.findOne.mockResolvedValueOnce({
          id: WORKSPACE_ID,
          activationStatus,
        } as never);

        expectRefused(await grant(buildAssertion()), 'invalid_grant');
      }
    });

    it('an unknown workspace', async () => {
      const { grant } = setup();

      expectRefused(
        await grant(
          buildAssertion({
            workspace_id: '20202020-0000-4000-8000-00000000dead',
          }),
        ),
        'invalid_grant',
      );
    });

    it('a subject the directory does not know', async () => {
      const { grant } = setup();

      expectRefused(
        await grant(buildAssertion({ sub: 'user_01UNKNOWN' })),
        'invalid_grant',
      );
    });

    it('a directory user whose e-mail is not verified', async () => {
      const { grant, mocks } = setup();

      mocks.directory.findUser.mockResolvedValueOnce({
        id: DIRECTORY_USER_ID,
        email: EMAIL,
        firstName: null,
        lastName: null,
        isEmailVerified: false,
      } as never);

      expectRefused(await grant(buildAssertion()), 'invalid_grant');
    });

    it('when the directory is not configured', async () => {
      const { grant, mocks } = setup();

      mocks.directory.isEnabled.mockReturnValue(false);

      expectRefused(await grant(buildAssertion()), 'invalid_grant');
    });

    it('a person without a CRM user', async () => {
      const { grant, mocks } = setup();

      mocks.userRepository.findOne.mockResolvedValueOnce(null as never);

      expectRefused(await grant(buildAssertion()), 'invalid_grant');
    });

    it('a member of another workspace', async () => {
      const { grant, mocks } = setup();

      expectRefused(
        await grant(buildAssertion({ workspace_id: OTHER_WORKSPACE_ID })),
        'invalid_grant',
      );
      expect(
        mocks.applicationTokenService.generateApplicationTokenPair,
      ).not.toHaveBeenCalled();
      expect(
        mocks.oauthService.findOrInstallApplication,
      ).not.toHaveBeenCalled();
    });
  });

  describe('installation on the first exchange', () => {
    it('runs under a lock and releases it', async () => {
      const { grant, mocks, locks } = setup();

      await grant(buildAssertion());

      expect(mocks.lockCache.setIfAbsent).toHaveBeenCalledWith(
        `colabos-jwt-bearer:install:registration-1:${WORKSPACE_ID}`,
        expect.any(String),
        30_000,
      );
      expect(mocks.lockCache.runScript).toHaveBeenCalledWith(
        expect.objectContaining({ script: RELEASE_INSTALL_LOCK_SCRIPT }),
      );
      expect(locks.size).toBe(0);
    });

    it('serializes two simultaneous exchanges in the same workspace', async () => {
      const { grant, mocks } = setup();
      let running = 0;
      let maxRunning = 0;

      mocks.oauthService.findOrInstallApplication.mockImplementation(
        async () => {
          running++;
          maxRunning = Math.max(maxRunning, running);
          await new Promise((resolve) => setTimeout(resolve, 50));
          running--;

          return { id: 'application-1' };
        },
      );

      const [first, second] = await Promise.all([
        grant(buildAssertion()),
        grant(buildAssertion()),
      ]);

      expect(first.ok && second.ok).toBe(true);
      expect(maxRunning).toBe(1);
      expect(mocks.oauthService.findOrInstallApplication).toHaveBeenCalledTimes(
        2,
      );
    });

    it('never frees a lock that another holder took after expiry', async () => {
      const { grant, mocks, locks } = setup();
      const lockKey = `colabos-jwt-bearer:install:registration-1:${WORKSPACE_ID}`;

      mocks.oauthService.findOrInstallApplication.mockImplementationOnce(
        async () => {
          // Our lock expired mid-install and someone else took it.
          locks.set(lockKey, JSON.stringify('another-holder'));

          return { id: 'application-1' };
        },
      );

      expect((await grant(buildAssertion())).ok).toBe(true);
      expect(locks.get(lockKey)).toBe(JSON.stringify('another-holder'));
    });

    it('releases the lock when the install fails', async () => {
      const { grant, mocks, locks } = setup();

      mocks.oauthService.findOrInstallApplication.mockRejectedValueOnce(
        new Error('boom'),
      );

      await expect(grant(buildAssertion())).rejects.toThrow('boom');
      expect(locks.size).toBe(0);
    });
  });
});
