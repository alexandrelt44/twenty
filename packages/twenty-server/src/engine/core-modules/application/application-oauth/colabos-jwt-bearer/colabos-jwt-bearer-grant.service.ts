import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createPublicKey, randomUUID, type KeyObject } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';
import { decode, type JwtPayload, verify } from 'jsonwebtoken';
import ms from 'ms';
import { isDefined } from 'twenty-shared/utils';
import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { Repository } from 'typeorm';

import { ApplicationAuthorizationService } from 'src/engine/core-modules/application/application-authorization/services/application-authorization.service';
import { type ApplicationRegistrationEntity } from 'src/engine/core-modules/application/application-registration/application-registration.entity';
import { ApplicationRegistrationService } from 'src/engine/core-modules/application/application-registration/application-registration.service';
import { type ApplicationEntity } from 'src/engine/core-modules/application/application.entity';
import { OAuthService } from 'src/engine/core-modules/application/application-oauth/oauth.service';
import { type OAuthErrorResponse } from 'src/engine/core-modules/application/application-oauth/types/oauth-error-response.type';
import { type OAuthTokenResponse } from 'src/engine/core-modules/application/application-oauth/types/oauth-token-response.type';
import { WorkspaceAccessDirectory } from 'src/engine/core-modules/auth/services/workspace-access-directory';
import { ApplicationTokenService } from 'src/engine/core-modules/auth/token/services/application-token.service';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { cleanServerUrl } from 'src/utils/clean-server-url';

export const JWT_BEARER_GRANT_TYPE =
  'urn:ietf:params:oauth:grant-type:jwt-bearer';

// ColabAuth is the only issuer: it signs one assertion per person and
// workspace, right before exchanging it.
export const COLABOS_ASSERTION_ISSUER = 'colabauth';

export const COLABOS_ASSERTION_MAX_LIFETIME_SECONDS = 5 * 60;
export const COLABOS_ASSERTION_CLOCK_TOLERANCE_SECONDS = 30;

// The jti outlives the assertion by a margin, so a replay can never land
// after its key expired from the cache.
const JTI_TTL_MARGIN_MS = 60_000;
const JTI_MAX_LENGTH = 128;

const INSTALL_LOCK_TTL_MS = 30_000;
const INSTALL_LOCK_WAIT_MS = 15_000;
const INSTALL_LOCK_POLL_MS = 200;

// Deletes the lock only while it still holds this holder's token, so a holder
// whose lock already expired never frees the lock of the next one.
export const RELEASE_INSTALL_LOCK_SCRIPT = {
  name: 'colabos-jwt-bearer-release-install-lock',
  source: `if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0`,
};

type ColabosAssertionPayload = JwtPayload & { workspace_id?: unknown };

export type ColabosJwtBearerGrantInput = {
  assertion: string;
  clientId: string;
  isProxied: boolean;
};

export type ColabosJwtBearerGrantResult =
  | { ok: true; response: OAuthTokenResponse }
  | { ok: false; status: number; response: OAuthErrorResponse };

// RFC 7523 §2.1 grant for ColabOS: ColabAuth asserts "this WorkOS user, in
// this workspace" and the CRM issues the same user-context token pair the
// authorization_code grant would, with the application attached, so the
// user's own role still bounds what the token can do.
@Injectable()
export class ColabosJwtBearerGrantService {
  private readonly logger = new Logger(ColabosJwtBearerGrantService.name);

  private parsedKeysSource: string | null = null;
  private parsedKeys = new Map<string, KeyObject>();

  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly applicationRegistrationService: ApplicationRegistrationService,
    private readonly applicationAuthorizationService: ApplicationAuthorizationService,
    private readonly applicationTokenService: ApplicationTokenService,
    private readonly oauthService: OAuthService,
    private readonly directory: WorkspaceAccessDirectory,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectCacheStorage(CacheStorageNamespace.EngineAuthSession)
    private readonly jtiCache: CacheStorageService,
    @InjectCacheStorage(CacheStorageNamespace.EngineLock)
    private readonly lockCache: CacheStorageService,
  ) {}

  isEnabled(): boolean {
    return (
      isNonEmptyString(
        this.twentyConfigService.get('COLABOS_OAUTH_CLIENT_ID'),
      ) && this.getPublicKeys().size > 0
    );
  }

  async grant({
    assertion,
    clientId,
    isProxied,
  }: ColabosJwtBearerGrantInput): Promise<ColabosJwtBearerGrantResult> {
    if (
      isProxied &&
      !this.twentyConfigService.get('COLABOS_JWT_BEARER_ALLOW_PROXIED')
    ) {
      return this.refuse(
        403,
        'unauthorized_client',
        'This grant is only available on the internal network',
        'proxied',
      );
    }

    const allowedClientId = this.twentyConfigService.get(
      'COLABOS_OAUTH_CLIENT_ID',
    );

    if (!isNonEmptyString(clientId) || clientId !== allowedClientId) {
      return this.refuse(
        401,
        'unauthorized_client',
        'This client may not use the jwt-bearer grant',
        'client_id',
      );
    }

    const applicationRegistration =
      await this.applicationRegistrationService.findOneByClientId(clientId);

    if (!isDefined(applicationRegistration)) {
      return this.refuse(401, 'invalid_client', 'Client not found', 'client');
    }

    if (!isNonEmptyString(assertion)) {
      return this.refuse(
        400,
        'invalid_request',
        'assertion is required',
        'no_assertion',
      );
    }

    const checked = this.verifyAssertion(assertion);

    if ('reason' in checked) {
      return this.refuse(
        400,
        'invalid_grant',
        'Invalid assertion',
        checked.reason,
      );
    }

    const { payload, workspaceId, jti } = checked;
    const directoryUserId = payload.sub as string;

    // Claimed before anything else is looked up, so a replay is refused even
    // when the first use failed further down.
    const jtiTtlMs =
      ((payload.exp as number) + COLABOS_ASSERTION_CLOCK_TOLERANCE_SECONDS) *
        1000 -
      Date.now() +
      JTI_TTL_MARGIN_MS;
    const isFirstUse = await this.jtiCache.setIfAbsent(
      `colabos-jwt-bearer:jti:${jti}`,
      true,
      Math.max(jtiTtlMs, JTI_TTL_MARGIN_MS),
    );

    if (!isFirstUse) {
      return this.refuse(
        400,
        'invalid_grant',
        'Invalid assertion',
        'jti_replay',
      );
    }

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (
      !isDefined(workspace) ||
      workspace.activationStatus !== WorkspaceActivationStatus.ACTIVE
    ) {
      return this.refuse(
        400,
        'invalid_grant',
        'Workspace is not available',
        'workspace_not_active',
        { workspaceId },
      );
    }

    if (!this.directory.isEnabled()) {
      return this.refuse(
        400,
        'invalid_grant',
        'User directory is not configured',
        'directory_disabled',
      );
    }

    // Only the subject is trusted from the assertion: the e-mail comes from
    // the directory itself, and only once verified, as on sign-in.
    const directoryUser = await this.directory.findUser(directoryUserId);

    if (!isDefined(directoryUser) || !directoryUser.isEmailVerified) {
      return this.refuse(
        400,
        'invalid_grant',
        'User not found',
        isDefined(directoryUser) ? 'email_not_verified' : 'directory_user',
        { workspaceId, directoryUserId },
      );
    }

    const user = await this.userRepository.findOne({
      // Same lookup as the directory sync of sign-in (PR #4).
      where: { email: directoryUser.email },
    });

    const userWorkspace = isDefined(user)
      ? await this.userWorkspaceRepository.findOne({
          where: { userId: user.id, workspaceId },
        })
      : null;

    if (!isDefined(user) || !isDefined(userWorkspace)) {
      return this.refuse(
        400,
        'invalid_grant',
        'User is not a member of this workspace',
        isDefined(user) ? 'not_member' : 'crm_user',
        { workspaceId, directoryUserId },
      );
    }

    const application = await this.findOrInstallApplicationOnce(
      applicationRegistration,
      workspaceId,
    );

    if (!isDefined(application)) {
      return this.refuse(
        503,
        'temporarily_unavailable',
        'Application installation is in progress, retry shortly',
        'install_lock',
        { workspaceId },
      );
    }

    const scopes = applicationRegistration.oAuthScopes;

    // Same order as the authorization_code grant: the authorization exists
    // before the refresh token, so refresh and revoke both find it.
    await this.applicationAuthorizationService.recordAuthorization({
      userId: user.id,
      workspaceId,
      userWorkspaceId: userWorkspace.id,
      applicationId: application.id,
      scopes,
    });

    const { applicationAccessToken, applicationRefreshToken } =
      await this.applicationTokenService.generateApplicationTokenPair({
        workspaceId,
        applicationId: application.id,
        userId: user.id,
        userWorkspaceId: userWorkspace.id,
      });

    this.logger.log(
      `jwt-bearer tokens issued: workspace=${workspaceId} user=${user.id} application=${application.id}`,
    );

    return {
      ok: true,
      response: {
        access_token: applicationAccessToken.token,
        token_type: 'Bearer',
        expires_in: Math.floor(
          ms(
            this.twentyConfigService.get('APPLICATION_ACCESS_TOKEN_EXPIRES_IN'),
          ) / 1000,
        ),
        refresh_token: applicationRefreshToken.token,
        scope: scopes.join(' '),
      },
    };
  }

  private verifyAssertion(
    assertion: string,
  ):
    | { payload: ColabosAssertionPayload; workspaceId: string; jti: string }
    | { reason: string } {
    const header = decode(assertion, { complete: true })?.header;

    if (!isDefined(header) || header.alg !== 'ES256') {
      return { reason: 'malformed' };
    }

    const key = isNonEmptyString(header.kid)
      ? this.getPublicKeys().get(header.kid)
      : undefined;

    if (!isDefined(key)) {
      return { reason: 'unknown_kid' };
    }

    const audience = cleanServerUrl(this.twentyConfigService.get('SERVER_URL'));

    if (!isNonEmptyString(audience)) {
      return { reason: 'no_audience' };
    }

    let payload: ColabosAssertionPayload;

    try {
      payload = verify(assertion, key, {
        algorithms: ['ES256'],
        issuer: COLABOS_ASSERTION_ISSUER,
        audience,
        clockTolerance: COLABOS_ASSERTION_CLOCK_TOLERANCE_SECONDS,
      }) as ColabosAssertionPayload;
    } catch (error) {
      return {
        reason:
          error instanceof Error && error.name === 'TokenExpiredError'
            ? 'expired'
            : 'signature_or_claims',
      };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);

    if (
      typeof payload.exp !== 'number' ||
      typeof payload.iat !== 'number' ||
      payload.iat > nowSeconds + COLABOS_ASSERTION_CLOCK_TOLERANCE_SECONDS ||
      payload.exp - payload.iat > COLABOS_ASSERTION_MAX_LIFETIME_SECONDS
    ) {
      return { reason: 'lifetime' };
    }

    if (!isNonEmptyString(payload.jti) || payload.jti.length > JTI_MAX_LENGTH) {
      return { reason: 'jti' };
    }

    if (!isNonEmptyString(payload.sub)) {
      return { reason: 'sub' };
    }

    if (!isNonEmptyString(payload.workspace_id)) {
      return { reason: 'workspace_id' };
    }

    return { payload, workspaceId: payload.workspace_id, jti: payload.jti };
  }

  // The first exchange in a workspace installs the application. Two people
  // opening ColabOS at once must not install it twice, so the install runs
  // under a lock and re-reads before installing. The lock holds a token of its
  // own and is released only by its holder.
  private async findOrInstallApplicationOnce(
    applicationRegistration: ApplicationRegistrationEntity,
    workspaceId: string,
  ): Promise<ApplicationEntity | null> {
    const lockKey = `colabos-jwt-bearer:install:${applicationRegistration.id}:${workspaceId}`;
    const lockToken = randomUUID();
    const deadline = Date.now() + INSTALL_LOCK_WAIT_MS;

    while (
      !(await this.lockCache.setIfAbsent(
        lockKey,
        lockToken,
        INSTALL_LOCK_TTL_MS,
      ))
    ) {
      if (Date.now() >= deadline) {
        return null;
      }

      await new Promise((resolve) => setTimeout(resolve, INSTALL_LOCK_POLL_MS));
    }

    try {
      return await this.oauthService.findOrInstallApplication(
        applicationRegistration,
        workspaceId,
      );
    } finally {
      // setIfAbsent stores the value JSON-encoded.
      await this.lockCache.runScript<number>({
        script: RELEASE_INSTALL_LOCK_SCRIPT,
        keys: [lockKey],
        args: [JSON.stringify(lockToken)],
      });
    }
  }

  // COLABOS_ASSERTION_PUBLIC_KEYS holds {"<kid>": "<PEM>"}: more than one key
  // lets a new key be added before the old one is retired.
  private getPublicKeys(): Map<string, KeyObject> {
    const source =
      this.twentyConfigService.get('COLABOS_ASSERTION_PUBLIC_KEYS') ?? '';

    if (source === this.parsedKeysSource) {
      return this.parsedKeys;
    }

    const keys = new Map<string, KeyObject>();

    if (isNonEmptyString(source)) {
      try {
        const entries = JSON.parse(source) as Record<string, unknown>;

        for (const [kid, pem] of Object.entries(entries)) {
          if (!isNonEmptyString(kid) || !isNonEmptyString(pem)) continue;

          const key = createPublicKey(pem.replace(/\\n/g, '\n'));

          if (key.asymmetricKeyType !== 'ec') continue;

          keys.set(kid, key);
        }
      } catch {
        this.logger.error(
          'COLABOS_ASSERTION_PUBLIC_KEYS is not a valid {kid: PEM} JSON object; the jwt-bearer grant stays disabled',
        );
        keys.clear();
      }
    }

    this.parsedKeysSource = source;
    this.parsedKeys = keys;

    return keys;
  }

  private refuse(
    status: number,
    error: string,
    errorDescription: string,
    reason: string,
    context: Record<string, string> = {},
  ): ColabosJwtBearerGrantResult {
    const details = Object.entries(context)
      .map(([key, value]) => `${key}=${value}`)
      .join(' ');

    this.logger.warn(
      `jwt-bearer grant refused: reason=${reason}${details ? ` ${details}` : ''}`,
    );

    return {
      ok: false,
      status,
      response: { error, error_description: errorDescription },
    };
  }
}
