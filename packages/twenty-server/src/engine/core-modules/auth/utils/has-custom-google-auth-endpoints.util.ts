import { isNonEmptyString } from '@sniptt/guards';

import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

// AUTH_GOOGLE_CLIENT_ID is shared with the Gmail and Calendar connection, so
// these endpoints mean that client is not a Google one and cannot reach them.
export const hasCustomGoogleAuthEndpoints = (
  twentyConfigService: Pick<TwentyConfigService, 'get'>,
): boolean =>
  (
    [
      'AUTH_GOOGLE_AUTHORIZATION_URL',
      'AUTH_GOOGLE_TOKEN_URL',
      'AUTH_GOOGLE_USER_PROFILE_URL',
    ] as const
  ).some((variableName) =>
    isNonEmptyString(twentyConfigService.get(variableName)),
  );
