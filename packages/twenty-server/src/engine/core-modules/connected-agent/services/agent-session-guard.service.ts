import { Injectable } from '@nestjs/common';

import { AGENT_SESSION_TTL_MS } from 'src/engine/core-modules/connected-agent/constants/agent-session.const';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';
import { isApiKeyAuthContext } from 'src/engine/core-modules/auth/guards/is-api-key-auth-context.guard';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import {
  PermissionsException,
  PermissionsExceptionCode,
} from 'src/engine/metadata-modules/permissions/permissions.exception';

@Injectable()
export class AgentSessionGuardService {
  constructor(
    private readonly connectedAgentService: ConnectedAgentService,
  ) {}

  isSessionActive(lastSeenAt: Date | null): boolean {
    if (lastSeenAt === null) {
      return false;
    }

    return Date.now() - new Date(lastSeenAt).getTime() < AGENT_SESSION_TTL_MS;
  }

  async assertActiveSession(authContext: WorkspaceAuthContext): Promise<void> {
    if (!isApiKeyAuthContext(authContext)) {
      return;
    }

    const connectedAgent =
      await this.connectedAgentService.findActiveByApiKeyId(
        authContext.apiKey.id,
        authContext.workspace.id,
      );

    if (connectedAgent === null) {
      return;
    }

    if (!this.isSessionActive(connectedAgent.lastSeenAt)) {
      throw new PermissionsException(
        'Agent must connect to the bridge before writing',
        PermissionsExceptionCode.PERMISSION_DENIED,
      );
    }
  }
}
