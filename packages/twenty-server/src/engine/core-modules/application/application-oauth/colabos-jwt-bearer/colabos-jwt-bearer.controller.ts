import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  Res,
  UseFilters,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';

import { type Request, type Response } from 'express';
import { isDefined } from 'twenty-shared/utils';

import {
  ColabosJwtBearerGrantService,
  JWT_BEARER_GRANT_TYPE,
} from 'src/engine/core-modules/application/application-oauth/colabos-jwt-bearer/colabos-jwt-bearer-grant.service';
import { ColabosJwtBearerTokenInput } from 'src/engine/core-modules/application/application-oauth/colabos-jwt-bearer/colabos-jwt-bearer-token.input';
import { AuthRestApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-rest-api-exception.filter';
import { ThrottlerException } from 'src/engine/core-modules/throttler/throttler.exception';
import { ThrottlerService } from 'src/engine/core-modules/throttler/throttler.service';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

// Token endpoint of the ColabOS jwt-bearer grant (RFC 7523 §2.1). It lives
// under /colabauth/v1, which the public reverse proxy already blocks, and it
// also refuses anything that came through a proxy: only ColabAuth, on the
// internal network, reaches it. The public /oauth/token is untouched.
@Controller('colabauth/v1/oauth')
@UseFilters(AuthRestApiExceptionFilter)
export class ColabosJwtBearerController {
  constructor(
    private readonly grantService: ColabosJwtBearerGrantService,
    private readonly throttlerService: ThrottlerService,
  ) {}

  @Post('token')
  @HttpCode(200)
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @UsePipes(new ValidationPipe())
  async token(
    @Body() body: ColabosJwtBearerTokenInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!this.grantService.isEnabled()) {
      throw new NotFoundException();
    }

    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');

    if (await this.isRateLimited(req, res)) return;

    if (body.grant_type !== JWT_BEARER_GRANT_TYPE) {
      res.status(400);

      return {
        error: 'unsupported_grant_type',
        error_description: `Only ${JWT_BEARER_GRANT_TYPE} is supported here`,
      };
    }

    const result = await this.grantService.grant({
      assertion: body.assertion ?? '',
      clientId: body.client_id ?? '',
      isProxied: isDefined(req.headers['x-forwarded-for']),
    });

    if (!result.ok) {
      res.status(result.status);
    }

    return result.response;
  }

  private async isRateLimited(req: Request, res: Response): Promise<boolean> {
    try {
      await this.throttlerService.tokenBucketThrottleOrThrow(
        `colabos-jwt-bearer:${req.ip}`,
        1,
        RATE_LIMIT_MAX,
        RATE_LIMIT_WINDOW_MS,
      );

      return false;
    } catch (error) {
      if (error instanceof ThrottlerException) {
        res.status(429);
        res.json({
          error: 'rate_limit_exceeded',
          error_description: 'Too many requests, please try again later',
        });

        return true;
      }

      throw error;
    }
  }
}
