import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { isNonEmptyString } from '@sniptt/guards';
import { type Request } from 'express';
import {
  Strategy,
  type Profile as GoogleProfile,
  type VerifyCallback,
} from 'passport-google-oauth20';
import { type APP_LOCALES } from 'twenty-shared/translations';
import { isNonEmptyArray, parseJson } from 'twenty-shared/utils';

import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { type SocialSsoSignInUpActionType } from 'src/engine/core-modules/auth/types/signInUp.type';
import { type SocialSsoState } from 'src/engine/core-modules/auth/types/social-sso-state.type';
import { hasCustomGoogleAuthEndpoints } from 'src/engine/core-modules/auth/utils/has-custom-google-auth-endpoints.util';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

export type GoogleRequest = Omit<
  Request,
  'user' | 'workspace' | 'workspaceMetadataVersion'
> & {
  user: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    picture: string | null;
    locale?: keyof typeof APP_LOCALES | null;
    workspaceInviteHash?: string;
    action: SocialSsoSignInUpActionType;
    workspaceId?: string;
    billingCheckoutSessionState?: string;
    returnToPath?: string;
    directoryUserId?: string;
  };
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly isDirectoryProvider: boolean;

  constructor(twentyConfigService: TwentyConfigService) {
    const authorizationURL = twentyConfigService.get(
      'AUTH_GOOGLE_AUTHORIZATION_URL',
    );
    const tokenURL = twentyConfigService.get('AUTH_GOOGLE_TOKEN_URL');
    const userProfileURL = twentyConfigService.get(
      'AUTH_GOOGLE_USER_PROFILE_URL',
    );
    const scopes = twentyConfigService
      .get('AUTH_GOOGLE_SCOPES')
      ?.filter(isNonEmptyString);

    super({
      clientID: twentyConfigService.get('AUTH_GOOGLE_CLIENT_ID'),
      clientSecret: twentyConfigService.get('AUTH_GOOGLE_CLIENT_SECRET'),
      callbackURL: twentyConfigService.get('AUTH_GOOGLE_CALLBACK_URL'),
      scope: isNonEmptyArray(scopes) ? scopes : ['email', 'profile'],
      passReqToCallback: true,
      ...(isNonEmptyString(authorizationURL) ? { authorizationURL } : {}),
      ...(isNonEmptyString(tokenURL) ? { tokenURL } : {}),
      ...(isNonEmptyString(userProfileURL) ? { userProfileURL } : {}),
    });

    // The library sends the token in the query string, which Google accepts
    // but OIDC userinfo endpoints are only required to take as a header.
    if (isNonEmptyString(userProfileURL)) {
      this._oauth2.useAuthorizationHeaderforGET(true);
    }

    this.isDirectoryProvider =
      hasCustomGoogleAuthEndpoints(twentyConfigService);
  }

  // oxlint-disable-next-line typescript/no-explicit-any
  authenticate(req: Request, options: any) {
    options = {
      ...options,
      state: JSON.stringify({
        workspaceInviteHash: req.query.workspaceInviteHash,
        workspaceId: req.params.workspaceId,
        billingCheckoutSessionState: req.query.billingCheckoutSessionState,
        action: req.query.action,
        locale: req.query.locale,
        returnToPath: req.query.returnToPath,
      }),
    };

    return super.authenticate(req, options);
  }

  async validate(
    request: GoogleRequest,
    _accessToken: string,
    _refreshToken: string,
    profile: GoogleProfile,
    done: VerifyCallback,
  ): Promise<void> {
    const { name, emails, photos } = profile;
    const state = parseJson<SocialSsoState>(request.query.state as string);

    const firstVerifiedEmail = emails?.find(
      (email) => email?.verified === true,
    )?.value;

    if (!firstVerifiedEmail) {
      throw new AuthException(
        'Please verify your email address with Google',
        AuthExceptionCode.EMAIL_NOT_VERIFIED,
      );
    }

    const user: GoogleRequest['user'] = {
      email: firstVerifiedEmail,
      firstName: name?.givenName,
      lastName: name?.familyName,
      picture: photos?.[0]?.value ?? null,
      workspaceInviteHash: state?.workspaceInviteHash,
      workspaceId: state?.workspaceId,
      billingCheckoutSessionState: state?.billingCheckoutSessionState,
      action: state?.action ?? 'list-available-workspaces',
      locale: state?.locale,
      returnToPath: state?.returnToPath,
      ...(this.isDirectoryProvider && isNonEmptyString(profile.id)
        ? { directoryUserId: profile.id }
        : {}),
    };

    done(null, user);
  }
}
