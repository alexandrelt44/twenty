import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  type RawBodyRequest,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type Request } from 'express';
import { ApiPath } from 'twenty-shared/types';

import { WorkspaceAccessSyncService } from 'src/engine/core-modules/auth/services/workspace-access-sync.service';
import { verifyWorkosWebhookSignature } from 'src/engine/core-modules/auth/utils/verify-workos-webhook-signature.util';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';

const ORGANIZATION_MEMBERSHIP_EVENT_PREFIX = 'organization_membership.';

type WorkosWebhookEvent = {
  id?: string;
  event?: string;
  data?: { user_id?: string; organization_id?: string };
};

@Controller()
export class WorkosWebhookController {
  private readonly logger = new Logger(WorkosWebhookController.name);

  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly workspaceAccessSyncService: WorkspaceAccessSyncService,
  ) {}

  @Post(`${ApiPath.Webhooks}/workos`)
  @HttpCode(HttpStatus.OK)
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async handleWebhook(
    @Headers('workos-signature') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    const secret = this.twentyConfigService.get('WORKOS_WEBHOOK_SECRET');

    if (
      !isNonEmptyString(secret) ||
      !this.workspaceAccessSyncService.isEnabled()
    ) {
      throw new NotFoundException();
    }

    if (
      !req.rawBody ||
      !verifyWorkosWebhookSignature({
        signatureHeader: signature,
        rawBody: req.rawBody,
        secret,
      })
    ) {
      throw new UnauthorizedException('Invalid WorkOS signature');
    }

    const event = JSON.parse(
      req.rawBody.toString('utf8'),
    ) as WorkosWebhookEvent;
    const directoryUserId = event.data?.user_id;
    const organizationId = event.data?.organization_id;

    if (
      !event.event?.startsWith(ORGANIZATION_MEMBERSHIP_EVENT_PREFIX) ||
      !isNonEmptyString(directoryUserId) ||
      !isNonEmptyString(organizationId)
    ) {
      return { received: true };
    }

    // A failure here returns a 5xx, so WorkOS retries the delivery.
    const outcome = await this.workspaceAccessSyncService.syncMembership({
      directoryUserId,
      organizationId,
    });

    this.logger.log(
      `WorkOS ${event.event} ${event.id ?? ''} for ${directoryUserId} in ${organizationId}: ${outcome}`,
    );

    return { received: true };
  }
}
