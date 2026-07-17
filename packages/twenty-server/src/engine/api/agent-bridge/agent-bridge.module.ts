import { Module } from '@nestjs/common';

import { AgentBridgeController } from 'src/engine/api/agent-bridge/controllers/agent-bridge.controller';
import { AgentBridgeGuard } from 'src/engine/api/agent-bridge/guards/agent-bridge.guard';
import { AgentBridgeService } from 'src/engine/api/agent-bridge/services/agent-bridge.service';
import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { ConnectedAgentModule } from 'src/engine/core-modules/connected-agent/connected-agent.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@Module({
  imports: [TokenModule, WorkspaceCacheStorageModule, ConnectedAgentModule],
  controllers: [AgentBridgeController],
  providers: [
    JwtAuthGuard,
    WorkspaceAuthGuard,
    AgentBridgeGuard,
    AgentBridgeService,
  ],
})
export class AgentBridgeModule {}
