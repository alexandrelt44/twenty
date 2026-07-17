import { Injectable } from '@nestjs/common';

import { AGENT_SESSION_TTL_MS } from 'src/engine/core-modules/connected-agent/constants/agent-session.const';
import { ConnectedAgentStatus } from 'src/engine/core-modules/connected-agent/enums/connected-agent-status.enum';
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
      await this.connectedAgentService.findByApiKeyId(
        authContext.apiKey.id,
        authContext.workspace.id,
      );

    if (connectedAgent === null) {
      return;
    }

    if (connectedAgent.status === ConnectedAgentStatus.DISABLED) {
      throw new PermissionsException(
        'This connected agent is disabled',
        PermissionsExceptionCode.PERMISSION_DENIED,
      );
    }

    if (!this.isSessionActive(connectedAgent.lastSeenAt)) {
      throw new PermissionsException(
        'Agent must connect to the bridge before writing',
        PermissionsExceptionCode.PERMISSION_DENIED,
      );
    }
  }
}
