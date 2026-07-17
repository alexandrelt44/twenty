import { Module } from '@nestjs/common';

import { ConnectedAgentModule } from 'src/engine/core-modules/connected-agent/connected-agent.module';
import { AgentSessionGuardService } from 'src/engine/core-modules/connected-agent/services/agent-session-guard.service';
import { AgentSessionGateCreateManyPreQueryHook } from 'src/engine/core-modules/connected-agent/query-hooks/agent-session-gate.create-many.pre-query-hook';
import { AgentSessionGateCreateOnePreQueryHook } from 'src/engine/core-modules/connected-agent/query-hooks/agent-session-gate.create-one.pre-query-hook';
import { AgentSessionGateDeleteManyPreQueryHook } from 'src/engine/core-modules/connected-agent/query-hooks/agent-session-gate.delete-many.pre-query-hook';
import { AgentSessionGateDeleteOnePreQueryHook } from 'src/engine/core-modules/connected-agent/query-hooks/agent-session-gate.delete-one.pre-query-hook';
import { AgentSessionGateUpdateManyPreQueryHook } from 'src/engine/core-modules/connected-agent/query-hooks/agent-session-gate.update-many.pre-query-hook';
import { AgentSessionGateUpdateOnePreQueryHook } from 'src/engine/core-modules/connected-agent/query-hooks/agent-session-gate.update-one.pre-query-hook';

@Module({
  imports: [ConnectedAgentModule],
  providers: [
    AgentSessionGuardService,
    AgentSessionGateCreateOnePreQueryHook,
    AgentSessionGateCreateManyPreQueryHook,
    AgentSessionGateUpdateOnePreQueryHook,
    AgentSessionGateUpdateManyPreQueryHook,
    AgentSessionGateDeleteOnePreQueryHook,
    AgentSessionGateDeleteManyPreQueryHook,
  ],
  exports: [
    AgentSessionGuardService,
    AgentSessionGateCreateOnePreQueryHook,
    AgentSessionGateCreateManyPreQueryHook,
    AgentSessionGateUpdateOnePreQueryHook,
    AgentSessionGateUpdateManyPreQueryHook,
    AgentSessionGateDeleteOnePreQueryHook,
    AgentSessionGateDeleteManyPreQueryHook,
  ],
})
export class AgentSessionGuardModule {}
