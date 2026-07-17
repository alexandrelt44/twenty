import { Test, type TestingModule } from '@nestjs/testing';

import { AgentSessionGuardService } from 'src/engine/core-modules/connected-agent/services/agent-session-guard.service';
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
          useValue: { findActiveByApiKeyId: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AgentSessionGuardService);
    connectedAgentService = module.get(ConnectedAgentService);
  });

  it('is a no-op for non-apiKey (user) auth contexts', async () => {
    await expect(service.assertActiveSession(userCtx)).resolves.toBeUndefined();
    expect(connectedAgentService.findActiveByApiKeyId).not.toHaveBeenCalled();
  });

  it('is a no-op when the apiKey does not belong to a connected agent', async () => {
    connectedAgentService.findActiveByApiKeyId.mockResolvedValue(null);
    await expect(service.assertActiveSession(apiKeyCtx)).resolves.toBeUndefined();
  });

  it('passes when the agent session is fresh', async () => {
    connectedAgentService.findActiveByApiKeyId.mockResolvedValue({
      id: 'agent-1',
      lastSeenAt: new Date(),
    } as never);
    await expect(service.assertActiveSession(apiKeyCtx)).resolves.toBeUndefined();
  });

  it('throws PermissionsException when the agent has never connected (lastSeenAt null)', async () => {
    connectedAgentService.findActiveByApiKeyId.mockResolvedValue({
      id: 'agent-1',
      lastSeenAt: null,
    } as never);
    await expect(service.assertActiveSession(apiKeyCtx)).rejects.toBeInstanceOf(
      PermissionsException,
    );
  });

  it('throws PermissionsException when the session has lapsed past the TTL', async () => {
    connectedAgentService.findActiveByApiKeyId.mockResolvedValue({
      id: 'agent-1',
      lastSeenAt: new Date(Date.now() - 600_000), // 10 min ago
    } as never);
    await expect(service.assertActiveSession(apiKeyCtx)).rejects.toBeInstanceOf(
      PermissionsException,
    );
  });
});
