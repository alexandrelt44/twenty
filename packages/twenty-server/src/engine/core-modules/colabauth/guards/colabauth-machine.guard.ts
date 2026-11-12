import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type Request } from 'express';
import { decode, type JwtPayload, verify } from 'jsonwebtoken';

import { ColabauthJwksService } from 'src/engine/core-modules/colabauth/services/colabauth-jwks.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

export const COLABAUTH_REQUIRED_SCOPE = 'colabcrm:superadmin';

type ColabauthTokenPayload = JwtPayload & {
  client_id?: string;
  org_id?: string;
  scope?: string;
};

// Only the ColabAuth machine identity may call these routes. Every check below
// is required: the audience is shared by all apps of the WorkOS environment,
// so it is the client id and the app scope that single out the caller.
@Injectable()
export class ColabauthMachineGuard implements CanActivate {
  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly colabauthJwksService: ColabauthJwksService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const issuer = this.twentyConfigService.get('WORKOS_ISSUER');
    const audience = this.twentyConfigService.get('COLABAUTH_AUDIENCE');
    const organizationId = this.twentyConfigService.get('COLABAUTH_ORG_ID');
    const allowedClientIds = (
      this.twentyConfigService.get('COLABAUTH_ALLOWED_CLIENT_IDS') ?? []
    ).filter(isNonEmptyString);

    if (
      !isNonEmptyString(issuer) ||
      !isNonEmptyString(audience) ||
      !isNonEmptyString(organizationId) ||
      allowedClientIds.length === 0
    ) {
      throw new NotFoundException();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');

    if (scheme !== 'Bearer' || !isNonEmptyString(token)) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const kid = decode(token, { complete: true })?.header.kid;

    if (!isNonEmptyString(kid)) {
      throw new UnauthorizedException('Invalid token');
    }

    const signingKey = await this.colabauthJwksService.getSigningKey(
      issuer,
      kid,
    );

    if (signingKey === null) {
      throw new UnauthorizedException('Invalid token');
    }

    let payload: ColabauthTokenPayload;

    try {
      payload = verify(token, signingKey, {
        algorithms: ['RS256'],
        issuer,
        audience,
      }) as ColabauthTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const scopes = (payload.scope ?? '').split(' ');

    if (
      !isNonEmptyString(payload.client_id) ||
      !allowedClientIds.includes(payload.client_id) ||
      payload.org_id !== organizationId ||
      !scopes.includes(COLABAUTH_REQUIRED_SCOPE)
    ) {
      throw new ForbiddenException('Caller is not the ColabAuth service');
    }

    return true;
  }
}
