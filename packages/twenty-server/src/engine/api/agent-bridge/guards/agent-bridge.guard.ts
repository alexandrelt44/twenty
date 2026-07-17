import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { getRequest } from 'src/utils/extract-request';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';

@Injectable()
export class AgentBridgeGuard implements CanActivate {
  constructor(
    private readonly connectedAgentService: ConnectedAgentService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequest(context);

    if (!isDefined(request?.apiKey) || !isDefined(request?.workspace)) {
      throw new ForbiddenException(
        'Agent bridge requires an API key authenticated request',
      );
    }

    const connectedAgent =
      await this.connectedAgentService.findActiveByApiKeyId(
        request.apiKey.id,
        request.workspace.id,
      );

    if (!isDefined(connectedAgent)) {
      throw new ForbiddenException(
        'This API key is not associated with an active connected agent',
      );
    }

    request.connectedAgent = connectedAgent;

    return true;
  }
}
