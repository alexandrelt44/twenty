import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { ConnectedAgentModule } from 'src/engine/core-modules/connected-agent/connected-agent.module';
import { ConnectedAgentResolver } from 'src/engine/core-modules/connected-agent/connected-agent.resolver';
import { ConnectedAgentProvisioningService } from 'src/engine/core-modules/connected-agent/services/connected-agent-provisioning.service';
import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConnectedAgentEntity]),
    ApiKeyModule,
    ConnectedAgentModule,
    PermissionsModule,
  ],
  providers: [ConnectedAgentProvisioningService, ConnectedAgentResolver],
  exports: [ConnectedAgentProvisioningService],
})
export class ConnectedAgentProvisioningModule {}
