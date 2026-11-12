import { generateKeyPairSync } from 'crypto';

import { sign } from 'jsonwebtoken';

import { ColabauthMachineGuard } from 'src/engine/core-modules/colabauth/guards/colabauth-machine.guard';

const ISSUER = 'https://auth.example.test';
const AUDIENCE = 'client_environment';
const CLIENT_ID = 'client_colabauth';
const ORGANIZATION_ID = 'org_colaboratorio';
const KID = 'key_1';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const otherKeyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });

const config: Record<string, unknown> = {
  WORKOS_ISSUER: ISSUER,
  COLABAUTH_AUDIENCE: AUDIENCE,
  COLABAUTH_ORG_ID: ORGANIZATION_ID,
  COLABAUTH_ALLOWED_CLIENT_IDS: [CLIENT_ID],
};

const buildToken = (
  claims: Record<string, unknown> = {},
  { key = privateKey, kid = KID } = {},
) =>
  sign(
    {
      client_id: CLIENT_ID,
      org_id: ORGANIZATION_ID,
      scope: 'colabcrm:superadmin',
      ...claims,
    },
    key,
    { algorithm: 'RS256', keyid: kid, issuer: ISSUER, audience: AUDIENCE },
  );

const buildGuard = (overrides: Record<string, unknown> = {}) =>
  new ColabauthMachineGuard(
    { get: (name: string) => ({ ...config, ...overrides })[name] } as never,
    {
      getSigningKey: jest.fn(async (_issuer: string, kid: string) =>
        kid === KID ? publicKey : null,
      ),
    } as never,
  );

const contextWith = (authorization?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  }) as never;

describe('ColabauthMachineGuard', () => {
  it('lets the ColabAuth machine identity through', async () => {
    await expect(
      buildGuard().canActivate(contextWith(`Bearer ${buildToken()}`)),
    ).resolves.toBe(true);
  });

  it('hides the routes when the configuration is incomplete', async () => {
    await expect(
      buildGuard({ COLABAUTH_ALLOWED_CLIENT_IDS: [] }).canActivate(
        contextWith(`Bearer ${buildToken()}`),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects a request without a bearer token', async () => {
    await expect(buildGuard().canActivate(contextWith())).rejects.toMatchObject(
      { status: 401 },
    );
  });

  it('rejects a token signed by another key', async () => {
    await expect(
      buildGuard().canActivate(
        contextWith(
          `Bearer ${buildToken({}, { key: otherKeyPair.privateKey })}`,
        ),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a token whose key is not published by the issuer', async () => {
    await expect(
      buildGuard().canActivate(
        contextWith(`Bearer ${buildToken({}, { kid: 'unknown' })}`),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rejects an expired token', async () => {
    await expect(
      buildGuard().canActivate(
        contextWith(
          `Bearer ${buildToken({ exp: Math.floor(Date.now() / 1000) - 60 })}`,
        ),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it.each([
    ['another app of the environment', { client_id: 'client_other' }],
    ['another organization', { org_id: 'org_other' }],
    ['a token without the superadmin scope', { scope: 'colabcrm:read' }],
  ])('forbids %s', async (_label, claims) => {
    await expect(
      buildGuard().canActivate(contextWith(`Bearer ${buildToken(claims)}`)),
    ).rejects.toMatchObject({ status: 403 });
  });
});
