import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { ColabauthController } from 'src/engine/core-modules/colabauth/controllers/colabauth.controller';
import { ColabauthMachineGuard } from 'src/engine/core-modules/colabauth/guards/colabauth-machine.guard';
import { ColabauthJwksService } from 'src/engine/core-modules/colabauth/services/colabauth-jwks.service';
import { ColabauthTenantService } from 'src/engine/core-modules/colabauth/services/colabauth-tenant.service';
import { SubdomainManagerModule } from 'src/engine/core-modules/domain/subdomain-manager/subdomain-manager.module';
import { WorkspaceDomainsModule } from 'src/engine/core-modules/domain/workspace-domains/workspace-domains.module';
import { KeyValuePairEntity } from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserWorkspaceModule } from 'src/engine/core-modules/user-workspace/user-workspace.module';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceModule } from 'src/engine/core-modules/workspace/workspace.module';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { RoleEntity } from 'src/engine/metadata-modules/role/role.entity';
import { provideWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/provide-workspace-scoped-repository';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceEntity,
      UserEntity,
      UserWorkspaceEntity,
      KeyValuePairEntity,
      RoleEntity,
    ]),
    AuthModule,
    WorkspaceModule,
    ApplicationModule,
    WorkspaceDomainsModule,
    SubdomainManagerModule,
    UserWorkspaceModule,
    WorkspaceCacheModule,
  ],
  controllers: [ColabauthController],
  providers: [
    ColabauthJwksService,
    ColabauthMachineGuard,
    ColabauthTenantService,
    provideWorkspaceScopedRepository(RoleEntity),
  ],
})
export class ColabauthModule {}
