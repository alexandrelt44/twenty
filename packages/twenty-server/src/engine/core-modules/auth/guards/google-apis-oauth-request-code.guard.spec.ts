import { AuthGuard } from '@nestjs/passport';
import { type ExecutionContext } from '@nestjs/common';

import { GoogleAPIsOauthRequestCodeGuard } from 'src/engine/core-modules/auth/guards/google-apis-oauth-request-code.guard';

const buildContext = () =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        query: { transientToken: 'transient-token' },
        params: {},
      }),
    }),
  }) as unknown as ExecutionContext;

const buildGuard = (config: Record<string, unknown>) => {
  const guardRedirectService = { dispatchErrorFromGuard: jest.fn() };

  const guard = new GoogleAPIsOauthRequestCodeGuard(
    { get: (key: string) => config[key] } as never,
    {
      verifyTransientToken: jest
        .fn()
        .mockResolvedValue({ workspaceId: 'workspace-id', userId: 'user-id' }),
    } as never,
    guardRedirectService as never,
    { findOneBy: jest.fn().mockResolvedValue(null) } as never,
    {
      getSubdomainAndCustomDomainFromWorkspaceFallbackOnDefaultSubdomain: jest
        .fn()
        .mockReturnValue({}),
    } as never,
  );

  return { guard, guardRedirectService };
};

describe('GoogleAPIsOauthRequestCodeGuard', () => {
  const GMAIL_ENABLED_CONFIG = {
    AUTH_GOOGLE_CLIENT_ID: 'client-id',
    AUTH_GOOGLE_CLIENT_SECRET: 'client-secret',
    AUTH_GOOGLE_APIS_CALLBACK_URL:
      'https://crm.example.com/auth/google-apis/get-access-token',
    MESSAGING_PROVIDER_GMAIL_ENABLED: true,
  };

  let superCanActivate: jest.SpyInstance;

  beforeEach(() => {
    superCanActivate = jest
      .spyOn(AuthGuard('google-apis').prototype, 'canActivate')
      .mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts the Google connection when the client is a Google one', async () => {
    const { guard, guardRedirectService } = buildGuard(GMAIL_ENABLED_CONFIG);

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);

    expect(guardRedirectService.dispatchErrorFromGuard).not.toHaveBeenCalled();
  });

  it('reports an error instead of redirecting to Google with another provider client', async () => {
    const { guard, guardRedirectService } = buildGuard({
      ...GMAIL_ENABLED_CONFIG,
      AUTH_GOOGLE_AUTHORIZATION_URL: 'https://idp.example.com/oauth2/authorize',
    });

    await expect(guard.canActivate(buildContext())).resolves.toBe(false);

    expect(superCanActivate).not.toHaveBeenCalled();
    expect(guardRedirectService.dispatchErrorFromGuard).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        message: 'Google apis auth is not enabled',
      }),
      expect.anything(),
    );
  });
});
