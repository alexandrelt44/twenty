import { hasCustomGoogleAuthEndpoints } from 'src/engine/core-modules/auth/utils/has-custom-google-auth-endpoints.util';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const buildConfig = (values: Record<string, unknown>) =>
  ({ get: (key: string) => values[key] }) as unknown as Pick<
    TwentyConfigService,
    'get'
  >;

describe('hasCustomGoogleAuthEndpoints', () => {
  it('is false when no endpoint is configured', () => {
    expect(hasCustomGoogleAuthEndpoints(buildConfig({}))).toBe(false);
  });

  it('is false when the endpoints are empty', () => {
    expect(
      hasCustomGoogleAuthEndpoints(
        buildConfig({
          AUTH_GOOGLE_AUTHORIZATION_URL: '',
          AUTH_GOOGLE_TOKEN_URL: '',
          AUTH_GOOGLE_USER_PROFILE_URL: '',
        }),
      ),
    ).toBe(false);
  });

  it.each([
    'AUTH_GOOGLE_AUTHORIZATION_URL',
    'AUTH_GOOGLE_TOKEN_URL',
    'AUTH_GOOGLE_USER_PROFILE_URL',
  ])('is true when %s is configured', (variableName) => {
    expect(
      hasCustomGoogleAuthEndpoints(
        buildConfig({ [variableName]: 'https://idp.example.com/oauth2/path' }),
      ),
    ).toBe(true);
  });

  it('ignores the scopes, which do not change the provider', () => {
    expect(
      hasCustomGoogleAuthEndpoints(
        buildConfig({ AUTH_GOOGLE_SCOPES: ['openid', 'email', 'profile'] }),
      ),
    ).toBe(false);
  });
});
