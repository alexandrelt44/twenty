import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type Response } from 'express';

import { ColabauthMachineGuard } from 'src/engine/core-modules/colabauth/guards/colabauth-machine.guard';
import { ColabauthTenantService } from 'src/engine/core-modules/colabauth/services/colabauth-tenant.service';
import {
  type ColabauthMembershipSyncResult,
  type ColabauthTenant,
} from 'src/engine/core-modules/colabauth/types/colabauth-tenant.type';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';

type CreateTenantBody = {
  name?: unknown;
  slug?: unknown;
  workosOrganizationId?: unknown;
};

type SyncMembershipBody = {
  workosUserId?: unknown;
  workosOrganizationId?: unknown;
};

const requireString = (value: unknown, field: string): string => {
  if (!isNonEmptyString(value)) {
    throw new BadRequestException(`${field} is required`);
  }

  return value.trim();
};

@Controller('colabauth/v1')
@UseGuards(PublicEndpointGuard, NoPermissionGuard, ColabauthMachineGuard)
export class ColabauthController {
  constructor(
    private readonly colabauthTenantService: ColabauthTenantService,
  ) {}

  @Post('tenants')
  async createTenant(
    @Body() body: CreateTenantBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ColabauthTenant> {
    const { created, tenant } = await this.colabauthTenantService.createTenant({
      name: requireString(body?.name, 'name'),
      slug: requireString(body?.slug, 'slug').toLowerCase(),
      workosOrganizationId: requireString(
        body?.workosOrganizationId,
        'workosOrganizationId',
      ),
    });

    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);

    return tenant;
  }

  @Get('tenants')
  async findTenantByOrganization(
    @Query('workosOrganizationId') workosOrganizationId: unknown,
  ): Promise<ColabauthTenant> {
    const tenant = await this.colabauthTenantService.findTenantByOrganization(
      requireString(workosOrganizationId, 'workosOrganizationId'),
    );

    if (tenant === null) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  @Get('tenants/:id')
  async getTenant(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ColabauthTenant> {
    return this.colabauthTenantService.getTenant(id);
  }

  @Post('tenants/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendTenant(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ColabauthTenant> {
    return this.colabauthTenantService.suspendTenant(id);
  }

  @Post('tenants/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivateTenant(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ColabauthTenant> {
    return this.colabauthTenantService.reactivateTenant(id);
  }

  @Post('tenants/:id/sync')
  @HttpCode(HttpStatus.OK)
  async syncTenant(@Param('id', ParseUUIDPipe) id: string) {
    return this.colabauthTenantService.syncTenant(id);
  }

  @Post('memberships/sync')
  async syncMembership(
    @Body() body: SyncMembershipBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ColabauthMembershipSyncResult> {
    const result = await this.colabauthTenantService.syncMembership({
      workosUserId: requireString(body?.workosUserId, 'workosUserId'),
      workosOrganizationId: requireString(
        body?.workosOrganizationId,
        'workosOrganizationId',
      ),
    });

    // 202 tells the caller the workspace is still being activated and the
    // same call should be retried.
    response.status(
      result.action === 'pending' ? HttpStatus.ACCEPTED : HttpStatus.OK,
    );

    return result;
  }
}
