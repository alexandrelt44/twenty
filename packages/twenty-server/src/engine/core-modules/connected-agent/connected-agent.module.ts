import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';

@Module({
  imports: [TypeOrmModule.forFeature([ConnectedAgentEntity])],
  providers: [ConnectedAgentService],
  exports: [ConnectedAgentService, TypeOrmModule],
})
export class ConnectedAgentModule {}
