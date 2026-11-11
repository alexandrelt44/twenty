import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import {
  type DirectoryMembership,
  type DirectoryUser,
  WorkspaceAccessDirectory,
} from 'src/engine/core-modules/auth/services/workspace-access-directory';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const WORKOS_API_URL = 'https://api.workos.com';
const WORKOS_REQUEST_TIMEOUT_MS = 10_000;
const WORKSPACE_ID_METADATA_KEY = 'colabcrm_workspace_id';

type WorkosUserResponse = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  email_verified: boolean;
};

type WorkosMembershipResponse = {
  organization_id: string;
  status: string;
  role?: { slug?: string | null } | null;
};

type WorkosOrganizationResponse = {
  metadata?: Record<string, string> | null;
};

@Injectable()
export class WorkosWorkspaceAccessDirectoryService extends WorkspaceAccessDirectory {
  constructor(private readonly twentyConfigService: TwentyConfigService) {
    super();
  }

  isEnabled(): boolean {
    return isNonEmptyString(this.twentyConfigService.get('WORKOS_API_KEY'));
  }

  async findUser(directoryUserId: string): Promise<DirectoryUser | null> {
    const user = await this.request<WorkosUserResponse>(
      `/user_management/users/${encodeURIComponent(directoryUserId)}`,
    );

    if (user === null) {
      return null;
    }

    return {
      id: user.id,
      email: user.email.toLowerCase(),
      firstName: user.first_name,
      lastName: user.last_name,
      isEmailVerified: user.email_verified === true,
    };
  }

  async listMemberships(
    directoryUserId: string,
  ): Promise<DirectoryMembership[]> {
    const response = await this.request<{ data: WorkosMembershipResponse[] }>(
      `/user_management/organization_memberships?user_id=${encodeURIComponent(directoryUserId)}&limit=100`,
    );

    return (response?.data ?? []).map((membership) => ({
      organizationId: membership.organization_id,
      roleSlug: membership.role?.slug ?? null,
      isActive: membership.status === 'active',
    }));
  }

  async findWorkspaceIdForOrganization(
    organizationId: string,
  ): Promise<string | null> {
    const organization = await this.request<WorkosOrganizationResponse>(
      `/organizations/${encodeURIComponent(organizationId)}`,
    );

    const workspaceId = organization?.metadata?.[WORKSPACE_ID_METADATA_KEY];

    return isNonEmptyString(workspaceId) ? workspaceId : null;
  }

  private async request<TResponse>(path: string): Promise<TResponse | null> {
    const response = await fetch(`${WORKOS_API_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${this.twentyConfigService.get('WORKOS_API_KEY')}`,
      },
      signal: AbortSignal.timeout(WORKOS_REQUEST_TIMEOUT_MS),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`WorkOS request failed with status ${response.status}`);
    }

    return (await response.json()) as TResponse;
  }
}
