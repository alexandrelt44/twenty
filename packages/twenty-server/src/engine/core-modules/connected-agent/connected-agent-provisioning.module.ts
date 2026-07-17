import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { ConnectedAgentResolver } from 'src/engine/core-modules/connected-agent/connected-agent.resolver';
import { ConnectedAgentProvisioningService } from 'src/engine/core-modules/connected-agent/services/connected-agent-provisioning.service';

@Module({
  imports: [TypeOrmModule.forFeature([ConnectedAgentEntity]), ApiKeyModule],
  providers: [ConnectedAgentProvisioningService, ConnectedAgentResolver],
  exports: [ConnectedAgentProvisioningService],
})
export class ConnectedAgentProvisioningModule {}
