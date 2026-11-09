import { plainToClass } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ConfigVariables } from 'src/engine/core-modules/twenty-config/config-variables';

const GOOGLE_AUTH_ENDPOINT_VARIABLES = [
  'AUTH_GOOGLE_AUTHORIZATION_URL',
  'AUTH_GOOGLE_TOKEN_URL',
  'AUTH_GOOGLE_USER_PROFILE_URL',
];

const getInvalidProperties = (config: Record<string, unknown>) =>
  validateSync(plainToClass(ConfigVariables, config), {
    strictGroups: true,
  }).map(({ property }) => property);

describe('Google auth config variables', () => {
  it('has no default for the optional variables', () => {
    const config = plainToClass(ConfigVariables, {});

    expect(config.AUTH_GOOGLE_AUTHORIZATION_URL).toBeUndefined();
    expect(config.AUTH_GOOGLE_TOKEN_URL).toBeUndefined();
    expect(config.AUTH_GOOGLE_USER_PROFILE_URL).toBeUndefined();
    expect(config.AUTH_GOOGLE_SCOPES).toBeUndefined();
  });

  it.each([undefined, ''])('accepts %j as an unset endpoint', (value) => {
    const invalidProperties = getInvalidProperties(
      Object.fromEntries(
        GOOGLE_AUTH_ENDPOINT_VARIABLES.map((name) => [name, value]),
      ),
    );

    expect(invalidProperties).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^AUTH_GOOGLE_.*_URL$/)]),
    );
  });

  it.each(GOOGLE_AUTH_ENDPOINT_VARIABLES)(
    'rejects a %s that is not a URL',
    (name) => {
      expect(getInvalidProperties({ [name]: 'not-a-url' })).toContain(name);
    },
  );

  it('reads the scopes from a comma-separated value', () => {
    const config = plainToClass(ConfigVariables, {
      AUTH_GOOGLE_SCOPES: 'openid,email,profile',
    });

    expect(config.AUTH_GOOGLE_SCOPES).toEqual(['openid', 'email', 'profile']);
    expect(
      getInvalidProperties({ AUTH_GOOGLE_SCOPES: 'openid,email' }),
    ).not.toContain('AUTH_GOOGLE_SCOPES');
  });
});
