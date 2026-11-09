import { type Profile as GoogleProfile } from 'passport-google-oauth20';

import {
  type GoogleRequest,
  GoogleStrategy,
} from 'src/engine/core-modules/auth/strategies/google.auth.strategy';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

type OAuth2Internals = {
  _authorizeUrl: string;
  _accessTokenUrl: string;
  _request: jest.Mock;
};

type StrategyInternals = {
  _oauth2: OAuth2Internals;
  _scope: string[];
  _userProfileURL: string;
  _userProfileFormat: string;
  userProfile: (
    accessToken: string,
    done: (error: Error | null, profile?: GoogleProfile) => void,
  ) => void;
};

const BASE_CONFIG = {
  AUTH_GOOGLE_CLIENT_ID: 'client-id',
  AUTH_GOOGLE_CLIENT_SECRET: 'client-secret',
  AUTH_GOOGLE_CALLBACK_URL: 'https://crm.example.com/auth/google/redirect',
};

const CUSTOM_ENDPOINTS_CONFIG = {
  AUTH_GOOGLE_AUTHORIZATION_URL: 'https://idp.example.com/oauth2/authorize',
  AUTH_GOOGLE_TOKEN_URL: 'https://idp.example.com/oauth2/token',
  AUTH_GOOGLE_USER_PROFILE_URL: 'https://idp.example.com/oauth2/userinfo',
  AUTH_GOOGLE_SCOPES: ['openid', 'email', 'profile'],
};

const buildStrategy = (config: Record<string, unknown> = {}) => {
  const values: Record<string, unknown> = { ...BASE_CONFIG, ...config };
  const twentyConfigService = {
    get: (key: string) => values[key],
  } as unknown as TwentyConfigService;

  const strategy = new GoogleStrategy(twentyConfigService);

  return {
    strategy,
    internals: strategy as unknown as StrategyInternals,
  };
};

const fetchProfile = (
  internals: StrategyInternals,
  userinfoResponse: Record<string, unknown>,
) =>
  new Promise<GoogleProfile>((resolve, reject) => {
    internals._oauth2._request = jest.fn(
      (_method, _url, _headers, _body, _token, callback) =>
        callback(null, JSON.stringify(userinfoResponse), {}),
    );

    internals.userProfile('access-token', (error, profile) =>
      error || !profile ? reject(error) : resolve(profile),
    );
  });

const validateProfile = async (
  strategy: GoogleStrategy,
  profile: GoogleProfile,
) => {
  const done = jest.fn();

  await strategy.validate(
    { query: { state: '{}' } } as unknown as GoogleRequest,
    'access-token',
    'refresh-token',
    profile,
    done,
  );

  return done;
};

describe('GoogleStrategy', () => {
  describe('options passed to the OAuth client', () => {
    it('keeps the Google endpoints and scopes when no variable is set', () => {
      const { internals } = buildStrategy();

      expect(internals._oauth2._authorizeUrl).toBe(
        'https://accounts.google.com/o/oauth2/v2/auth',
      );
      expect(internals._oauth2._accessTokenUrl).toBe(
        'https://www.googleapis.com/oauth2/v4/token',
      );
      expect(internals._userProfileURL).toBe(
        'https://www.googleapis.com/oauth2/v3/userinfo',
      );
      expect(internals._scope).toEqual(['email', 'profile']);
    });

    it('treats empty values as unset', () => {
      const { internals } = buildStrategy({
        AUTH_GOOGLE_AUTHORIZATION_URL: '',
        AUTH_GOOGLE_TOKEN_URL: '',
        AUTH_GOOGLE_USER_PROFILE_URL: '',
        AUTH_GOOGLE_SCOPES: [''],
      });

      expect(internals._oauth2._authorizeUrl).toBe(
        'https://accounts.google.com/o/oauth2/v2/auth',
      );
      expect(internals._oauth2._accessTokenUrl).toBe(
        'https://www.googleapis.com/oauth2/v4/token',
      );
      expect(internals._userProfileURL).toBe(
        'https://www.googleapis.com/oauth2/v3/userinfo',
      );
      expect(internals._scope).toEqual(['email', 'profile']);
    });

    it('uses the configured endpoints and scopes', () => {
      const { internals } = buildStrategy(CUSTOM_ENDPOINTS_CONFIG);

      expect(internals._oauth2._authorizeUrl).toBe(
        'https://idp.example.com/oauth2/authorize',
      );
      expect(internals._oauth2._accessTokenUrl).toBe(
        'https://idp.example.com/oauth2/token',
      );
      expect(internals._userProfileURL).toBe(
        'https://idp.example.com/oauth2/userinfo',
      );
      expect(internals._scope).toEqual(['openid', 'email', 'profile']);
    });

    it('reads a URL ending in /userinfo as an OpenID profile', () => {
      const { internals } = buildStrategy(CUSTOM_ENDPOINTS_CONFIG);

      expect(internals._userProfileFormat).toBe('openid');
    });
  });

  describe('userinfo request', () => {
    it('sends the access token in the query string to Google', async () => {
      const { internals } = buildStrategy();

      await fetchProfile(internals, { sub: 'user-id' });

      const [, , headers, , token] = internals._oauth2._request.mock.calls[0];

      expect(headers).toEqual({});
      expect(token).toBe('access-token');
    });

    it('sends the access token as a Bearer header to a custom provider', async () => {
      const { internals } = buildStrategy(CUSTOM_ENDPOINTS_CONFIG);

      await fetchProfile(internals, { sub: 'user-id' });

      const [, , headers, , token] = internals._oauth2._request.mock.calls[0];

      expect(headers).toEqual({ Authorization: 'Bearer access-token' });
      expect(token).toBeNull();
    });
  });

  describe('email verification', () => {
    const userinfoResponse = {
      sub: 'user-id',
      email: 'invitee@example.com',
      given_name: 'Ana',
      family_name: 'Souza',
    };

    it('accepts a provider that reports the email as verified', async () => {
      const { strategy, internals } = buildStrategy(CUSTOM_ENDPOINTS_CONFIG);

      const done = await validateProfile(
        strategy,
        await fetchProfile(internals, {
          ...userinfoResponse,
          email_verified: true,
        }),
      );

      expect(done).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          email: 'invitee@example.com',
          firstName: 'Ana',
          lastName: 'Souza',
        }),
      );
    });

    it.each([
      ['missing', {}],
      ['false', { email_verified: false }],
      ['the string "true"', { email_verified: 'true' }],
    ])('refuses the sign-in when email_verified is %s', async (_, claim) => {
      const { strategy, internals } = buildStrategy(CUSTOM_ENDPOINTS_CONFIG);
      const profile = await fetchProfile(internals, {
        ...userinfoResponse,
        ...claim,
      });
      const done = jest.fn();

      await expect(
        strategy.validate(
          { query: { state: '{}' } } as unknown as GoogleRequest,
          'access-token',
          'refresh-token',
          profile,
          done,
        ),
      ).rejects.toThrow('Please verify your email address with Google');

      expect(done).not.toHaveBeenCalled();
    });

    it('refuses the sign-in when the profile URL does not end in /userinfo', async () => {
      const { strategy, internals } = buildStrategy({
        ...CUSTOM_ENDPOINTS_CONFIG,
        AUTH_GOOGLE_USER_PROFILE_URL:
          'https://idp.example.com/oauth2/userinfo/',
      });
      const profile = await fetchProfile(internals, {
        ...userinfoResponse,
        email_verified: true,
      });

      await expect(validateProfile(strategy, profile)).rejects.toThrow(
        'Please verify your email address with Google',
      );
    });
  });
});
