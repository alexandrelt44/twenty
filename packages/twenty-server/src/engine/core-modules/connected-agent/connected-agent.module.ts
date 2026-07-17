import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentActivityEntity } from 'src/engine/core-modules/connected-agent/agent-activity.entity';
import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { AgentActivityService } from 'src/engine/core-modules/connected-agent/services/agent-activity.service';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConnectedAgentEntity, AgentActivityEntity]),
  ],
  providers: [ConnectedAgentService, AgentActivityService],
  exports: [ConnectedAgentService, AgentActivityService],
})
export class ConnectedAgentModule {}
