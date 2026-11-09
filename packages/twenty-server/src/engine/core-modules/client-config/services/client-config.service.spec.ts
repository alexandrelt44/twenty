import { ClientConfigService } from 'src/engine/core-modules/client-config/services/client-config.service';

const buildService = (config: Record<string, unknown>) =>
  new ClientConfigService(
    { get: (key: string) => config[key] } as never,
    {
      getFrontUrl: () => new URL('https://crm.example.com'),
      getPublicBaseHostnameOrUndefined: () => undefined,
    } as never,
    {
      getAdminFilteredModels: () => [],
      getResolvedProvidersForAdmin: () => ({}),
      getModelConfig: () => undefined,
      findDefaultModelForTier: () => undefined,
    } as never,
    { getMaintenanceMode: async () => null } as never,
  );

describe('ClientConfigService', () => {
  const GOOGLE_APIS_ENABLED_CONFIG = {
    MESSAGING_PROVIDER_GMAIL_ENABLED: true,
    CALENDAR_PROVIDER_GOOGLE_ENABLED: true,
  };

  it('offers the Gmail and Calendar connection with a Google client', async () => {
    const clientConfig = await buildService(
      GOOGLE_APIS_ENABLED_CONFIG,
    ).getClientConfig();

    expect(clientConfig.isGoogleMessagingEnabled).toBe(true);
    expect(clientConfig.isGoogleCalendarEnabled).toBe(true);
  });

  it('hides the Gmail and Calendar connection when sign-in uses another provider', async () => {
    const clientConfig = await buildService({
      ...GOOGLE_APIS_ENABLED_CONFIG,
      AUTH_GOOGLE_AUTHORIZATION_URL: 'https://idp.example.com/oauth2/authorize',
    }).getClientConfig();

    expect(clientConfig.isGoogleMessagingEnabled).toBe(false);
    expect(clientConfig.isGoogleCalendarEnabled).toBe(false);
  });
});
