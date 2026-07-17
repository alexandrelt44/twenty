import { Test, type TestingModule } from '@nestjs/testing';

import { AgentSessionGuardService } from 'src/engine/core-modules/connected-agent/services/agent-session-guard.service';
import { ConnectedAgentStatus } from 'src/engine/core-modules/connected-agent/enums/connected-agent-status.enum';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';
import { PermissionsException } from 'src/engine/metadata-modules/permissions/permissions.exception';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';

describe('AgentSessionGuardService', () => {
  let service: AgentSessionGuardService;
  let connectedAgentService: jest.Mocked<ConnectedAgentService>;

  const apiKeyCtx = {
    type: 'apiKey',
    workspace: { id: 'ws-1' },
    apiKey: { id: 'key-1', name: 'K' },
  } as unknown as WorkspaceAuthContext;

  const userCtx = {
    type: 'user',
    workspace: { id: 'ws-1' },
  } as unknown as WorkspaceAuthContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentSessionGuardService,
        {
          provide: ConnectedAgentService,
          useValue: { findByApiKeyId: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AgentSessionGuardService);
    connectedAgentService = module.get(ConnectedAgentService);
  });

  it('is a no-op for non-apiKey (user) auth contexts', async () => {
    await expect(service.assertActiveSession(userCtx)).resolves.toBeUndefined();
    expect(connectedAgentService.findByApiKeyId).not.toHaveBeenCalled();
  });

  it('is a no-op when the apiKey does not belong to a connected agent', async () => {
    connectedAgentService.findByApiKeyId.mockResolvedValue(null);
    await expect(service.assertActiveSession(apiKeyCtx)).resolves.toBeUndefined();
  });

  it('passes when the agent session is fresh', async () => {
    connectedAgentService.findByApiKeyId.mockResolvedValue({
      id: 'agent-1',
      status: ConnectedAgentStatus.ACTIVE,
      lastSeenAt: new Date(),
    } as never);
    await expect(service.assertActiveSession(apiKeyCtx)).resolves.toBeUndefined();
  });

  it('throws PermissionsException when the agent has never connected (lastSeenAt null)', async () => {
    connectedAgentService.findByApiKeyId.mockResolvedValue({
      id: 'agent-1',
      status: ConnectedAgentStatus.ACTIVE,
      lastSeenAt: null,
    } as never);
    await expect(service.assertActiveSession(apiKeyCtx)).rejects.toBeInstanceOf(
      PermissionsException,
    );
  });

  it('throws PermissionsException when the session has lapsed past the TTL', async () => {
    connectedAgentService.findByApiKeyId.mockResolvedValue({
      id: 'agent-1',
      status: ConnectedAgentStatus.ACTIVE,
      lastSeenAt: new Date(Date.now() - 600_000), // 10 min ago
    } as never);
    await expect(service.assertActiveSession(apiKeyCtx)).rejects.toBeInstanceOf(
      PermissionsException,
    );
  });

  it('throws PermissionsException when the connected agent is disabled', async () => {
    connectedAgentService.findByApiKeyId.mockResolvedValue({
      id: 'agent-1',
      status: ConnectedAgentStatus.DISABLED,
      lastSeenAt: new Date(),
    } as never);
    await expect(service.assertActiveSession(apiKeyCtx)).rejects.toBeInstanceOf(
      PermissionsException,
    );
  });
});
