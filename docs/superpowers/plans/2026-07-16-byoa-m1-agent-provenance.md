# BYOA M1 — Identidade de Agente + Proveniência (`source: AGENT`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um agente externo autenticado por API key opera o CRM via REST e suas escritas (create **e** update) ficam atribuídas a ele com `createdBy/updatedBy.source = AGENT` e o nome do agente.

**Architecture:** Nova entidade `core.connectedAgent` liga uma API key (o token) a uma identidade de agente exibível. O serviço central de proveniência do Twenty (`ActorFromAuthContextService.buildActorMetadata`) ganha um ramo: se a API key do `AuthContext` pertence a um `ConnectedAgent` ativo, carimba `source: AGENT` com o nome do agente; senão mantém o comportamento atual (`source: API`). Os pre-query hooks de `createdBy`/`updatedBy` **não mudam** — eles já chamam esse serviço, então create e update passam a atribuir ao agente automaticamente.

**Tech Stack:** NestJS, TypeORM (schema `core`), Jest (`@nx/jest`), GraphQL (`@nestjs/graphql`), Nx monorepo.

## Global Constraints

- Repo: `~/Projetos/twenty`, branch `dev` (fork `alexandrelt44/twenty` @ tag `v2.2.0`). Commitar nesta branch.
- Spec de referência: `docs/superpowers/specs/2026-07-16-byoa-agent-bridge-design.md`.
- Transporte é **REST + API key**. Não usar MCP. Não implementar suggestion/approval (é v2).
- Enum de proveniência já existe: `FieldActorSource` em `twenty-shared/types` (`actor.composite-type.ts`) contém `AGENT`. **Não criar enum novo.**
- Permissões do agente vêm **exclusivamente** de `apiKey → roleId` (via `RoleTargetEntity`). O `ConnectedAgent` **não** duplica role.
- **Desvio deliberado do spec:** o M1 **exige um `roleId` existente** no provisionamento (o operador cria a Role em Settings → Roles, que já existe). O spec mencionava criar Role automaticamente "se não informada" — fica fora do M1 (YAGNI).
- Rodar testes unitários: `cd packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=<padrão>` (~1s). NÃO usar `nx test` — o executor do nx ignora o filtro e roda a suíte inteira (538 suites, ~224s).
- Rodar migrations: `npx nx run twenty-server:database:migrate` (executa `run-instance-commands --force`; depende de `build`).
- Imports usam o alias `src/...` (não caminhos relativos longos), seguindo o padrão do `twenty-server`.
- **`ActorMetadata['context']` foi alargado** (commit 681421afa2) em `packages/twenty-shared/src/types/composite-types/actor.composite-type.ts` para aceitar `connectedAgentId?: string` — originalmente só aceitava `provider?`. Isso é o que permite `context: { connectedAgentId }` compilar. Não reverter.
- **Typecheck não é coberto pelos testes:** o jest usa `@swc/jest`, que remove tipos SEM checá-los. Um erro de tipo passa nos testes e só aparece no `tsc`. Ao mexer em tipos, rode: `cd packages/twenty-server && npx tsc --noEmit -p tsconfig.json --skipLibCheck 2>&1 | grep <seu-arquivo>` (o repo tem erros pré-existentes NÃO relacionados — ex.: `@file-type/pdf`, `is-psl-parsed-domain` — ignore-os).
- **Pegadinha:** `twenty-server` resolve `twenty-shared/types` contra `packages/twenty-shared/dist/` (buildado, gitignored). Se alterar `twenty-shared`, rode `npx nx build twenty-shared` na raiz, senão o `tsc` continua vendo o tipo antigo.

---

## File Structure

**Criar:**
- `packages/twenty-server/src/engine/core-modules/connected-agent/enums/connected-agent-status.enum.ts` — enum de status.
- `packages/twenty-server/src/engine/core-modules/connected-agent/connected-agent.entity.ts` — entidade `core.connectedAgent`.
- `packages/twenty-server/src/engine/core-modules/connected-agent/connected-agent.module.ts` — módulo **mínimo** (entidade + lookup). Sem dependência de `ApiKeyModule` (evita ciclo com `ActorModule`).
- `packages/twenty-server/src/engine/core-modules/connected-agent/services/connected-agent.service.ts` — lookup por API key.
- `packages/twenty-server/src/database/typeorm/core/migrations/common/1784227200000-add-connected-agent.ts` — migration.
- `packages/twenty-server/src/engine/core-modules/actor/utils/build-created-by-from-agent.util.ts` — builder `source: AGENT`.
- `packages/twenty-server/src/engine/core-modules/connected-agent/services/connected-agent-provisioning.service.ts` — cria API key + token + agente.
- `packages/twenty-server/src/engine/core-modules/connected-agent/connected-agent-provisioning.module.ts` — módulo de provisionamento (importa `ApiKeyModule`).
- `packages/twenty-server/src/engine/core-modules/connected-agent/dtos/create-connected-agent.input.ts` — input GraphQL.
- `packages/twenty-server/src/engine/core-modules/connected-agent/dtos/connected-agent-with-token.dto.ts` — retorno com token (exibido uma vez).
- `packages/twenty-server/src/engine/core-modules/connected-agent/connected-agent.resolver.ts` — mutation de provisionamento.

**Modificar:**
- `packages/twenty-server/src/engine/core-modules/actor/services/actor-from-auth-context.service.ts` — ramo AGENT (torna `buildActorMetadata` async).
- `packages/twenty-server/src/engine/core-modules/actor/actor.module.ts` — importar `ConnectedAgentModule`.

**Testes:**
- `packages/twenty-server/src/engine/core-modules/actor/utils/__tests__/build-created-by-from-agent.util.spec.ts`
- `packages/twenty-server/src/engine/core-modules/connected-agent/services/__tests__/connected-agent.service.spec.ts`
- `packages/twenty-server/src/engine/core-modules/actor/services/__tests__/actor-from-auth-context.service.spec.ts`
- `packages/twenty-server/src/engine/core-modules/connected-agent/services/__tests__/connected-agent-provisioning.service.spec.ts`

---

## Task 1: Entidade `ConnectedAgent` + migration

**Files:**
- Create: `packages/twenty-server/src/engine/core-modules/connected-agent/enums/connected-agent-status.enum.ts`
- Create: `packages/twenty-server/src/engine/core-modules/connected-agent/connected-agent.entity.ts`
- Create: `packages/twenty-server/src/database/typeorm/core/migrations/common/1784227200000-add-connected-agent.ts`

**Interfaces:**
- Consumes: `WorkspaceRelatedEntity` (fornece `workspaceId` + relação `workspace`), `ApiKeyEntity` (`core.apiKey`).
- Produces: `ConnectedAgentEntity` com campos `id: string`, `name: string`, `description: string | null`, `apiKeyId: string`, `status: ConnectedAgentStatus`, `lastSeenAt: Date | null`, `createdAt/updatedAt: Date`, `deletedAt: Date | null`; e `enum ConnectedAgentStatus { ACTIVE, DISABLED }`.

- [ ] **Step 1: Criar o enum de status**

Arquivo `packages/twenty-server/src/engine/core-modules/connected-agent/enums/connected-agent-status.enum.ts`:

```ts
import { registerEnumType } from '@nestjs/graphql';

export enum ConnectedAgentStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

registerEnumType(ConnectedAgentStatus, {
  name: 'ConnectedAgentStatus',
});
```

- [ ] **Step 2: Criar a entidade**

Arquivo `packages/twenty-server/src/engine/core-modules/connected-agent/connected-agent.entity.ts`:

```ts
import { Field, ObjectType } from '@nestjs/graphql';

import { IDField } from '@ptc-org/nestjs-query-graphql';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { ApiKeyEntity } from 'src/engine/core-modules/api-key/api-key.entity';
import { ConnectedAgentStatus } from 'src/engine/core-modules/connected-agent/enums/connected-agent-status.enum';
import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

@Index('IDX_CONNECTED_AGENT_WORKSPACE_ID', ['workspaceId'])
@Index('IDX_CONNECTED_AGENT_API_KEY_ID', ['apiKeyId'])
@Entity({ name: 'connectedAgent', schema: 'core' })
@ObjectType('ConnectedAgent')
export class ConnectedAgentEntity extends WorkspaceRelatedEntity {
  @IDField(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  name: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid' })
  apiKeyId: string;

  @ManyToOne(() => ApiKeyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'apiKeyId' })
  apiKey: Relation<ApiKeyEntity>;

  @Field(() => ConnectedAgentStatus)
  @Column({ type: 'text', default: ConnectedAgentStatus.ACTIVE })
  status: ConnectedAgentStatus;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @Field(() => Date)
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field(() => Date)
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
```

- [ ] **Step 3: Criar a migration**

Arquivo `packages/twenty-server/src/database/typeorm/core/migrations/common/1784227200000-add-connected-agent.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConnectedAgent1784227200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."connectedAgent" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "apiKeyId" uuid NOT NULL, "status" text NOT NULL DEFAULT 'ACTIVE', "lastSeenAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_CONNECTED_AGENT_ID" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_CONNECTED_AGENT_WORKSPACE_ID" ON "core"."connectedAgent" ("workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_CONNECTED_AGENT_API_KEY_ID" ON "core"."connectedAgent" ("apiKeyId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."connectedAgent" ADD CONSTRAINT "FK_CONNECTED_AGENT_WORKSPACE_ID" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."connectedAgent" ADD CONSTRAINT "FK_CONNECTED_AGENT_API_KEY_ID" FOREIGN KEY ("apiKeyId") REFERENCES "core"."apiKey"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "core"."connectedAgent"`);
  }
}
```

- [ ] **Step 4: Rodar a migration**

Run: `cd ~/Projetos/twenty && npx nx run twenty-server:database:migrate`
Expected: build + execução sem erro; a migration `AddConnectedAgent1784227200000` aparece como executada.

- [ ] **Step 5: Verificar que a tabela existe**

Run: `psql -d default -tAc "select column_name from information_schema.columns where table_schema='core' and table_name='connectedAgent' order by ordinal_position;"`
Expected: lista contendo `id, workspaceId, name, description, apiKeyId, status, lastSeenAt, createdAt, updatedAt, deletedAt`.

- [ ] **Step 6: Commit**

```bash
cd ~/Projetos/twenty
git add packages/twenty-server/src/engine/core-modules/connected-agent packages/twenty-server/src/database/typeorm/core/migrations/common/1784227200000-add-connected-agent.ts
git commit -m "feat(byoa): add connectedAgent entity and migration"
```

---

## Task 2: Builder de proveniência `source: AGENT`

**Files:**
- Create: `packages/twenty-server/src/engine/core-modules/actor/utils/build-created-by-from-agent.util.ts`
- Test: `packages/twenty-server/src/engine/core-modules/actor/utils/__tests__/build-created-by-from-agent.util.spec.ts`

**Interfaces:**
- Consumes: `ConnectedAgentEntity` (Task 1); `ActorMetadata` e `FieldActorSource` de `twenty-shared/types`.
- Produces: `buildCreatedByFromAgent({ connectedAgent: Pick<ConnectedAgentEntity, 'id' | 'name'> }): ActorMetadata`.

- [ ] **Step 1: Escrever o teste que falha**

Arquivo `packages/twenty-server/src/engine/core-modules/actor/utils/__tests__/build-created-by-from-agent.util.spec.ts`:

```ts
import { FieldActorSource } from 'twenty-shared/types';

import { buildCreatedByFromAgent } from 'src/engine/core-modules/actor/utils/build-created-by-from-agent.util';

describe('buildCreatedByFromAgent', () => {
  it('should stamp AGENT source with the agent name and id in context', () => {
    const result = buildCreatedByFromAgent({
      connectedAgent: {
        id: '20202020-1111-4444-8888-000000000001',
        name: 'ProofBot',
      },
    });

    expect(result).toEqual({
      source: FieldActorSource.AGENT,
      name: 'ProofBot',
      workspaceMemberId: null,
      context: { connectedAgentId: '20202020-1111-4444-8888-000000000001' },
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=build-created-by-from-agent`
Expected: FAIL — não consegue resolver o módulo `build-created-by-from-agent.util`.

- [ ] **Step 3: Implementar o builder**

Arquivo `packages/twenty-server/src/engine/core-modules/actor/utils/build-created-by-from-agent.util.ts`:

```ts
import { type ActorMetadata, FieldActorSource } from 'twenty-shared/types';

import { type ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';

type BuildCreatedByFromAgentArgs = {
  connectedAgent: Pick<ConnectedAgentEntity, 'id' | 'name'>;
};

export const buildCreatedByFromAgent = ({
  connectedAgent,
}: BuildCreatedByFromAgentArgs): ActorMetadata => ({
  source: FieldActorSource.AGENT,
  name: connectedAgent.name,
  workspaceMemberId: null,
  context: { connectedAgentId: connectedAgent.id },
});
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=build-created-by-from-agent`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
cd ~/Projetos/twenty
git add packages/twenty-server/src/engine/core-modules/actor/utils/build-created-by-from-agent.util.ts packages/twenty-server/src/engine/core-modules/actor/utils/__tests__/build-created-by-from-agent.util.spec.ts
git commit -m "feat(byoa): add buildCreatedByFromAgent actor builder"
```

---

## Task 3: `ConnectedAgentService` — lookup por API key

**Files:**
- Create: `packages/twenty-server/src/engine/core-modules/connected-agent/services/connected-agent.service.ts`
- Create: `packages/twenty-server/src/engine/core-modules/connected-agent/connected-agent.module.ts`
- Test: `packages/twenty-server/src/engine/core-modules/connected-agent/services/__tests__/connected-agent.service.spec.ts`

**Interfaces:**
- Consumes: `ConnectedAgentEntity`, `ConnectedAgentStatus` (Task 1).
- Produces:
  - `ConnectedAgentService.findActiveByApiKeyId(apiKeyId: string, workspaceId: string): Promise<ConnectedAgentEntity | null>`
  - `ConnectedAgentModule` — exporta APENAS `ConnectedAgentService` (boundary fechado: importadores não injetam o repositório direto). **Não importa `ApiKeyModule`** (evita ciclo quando `ActorModule` importar este módulo).

- [ ] **Step 1: Escrever o teste que falha**

Arquivo `packages/twenty-server/src/engine/core-modules/connected-agent/services/__tests__/connected-agent.service.spec.ts`:

```ts
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { IsNull, Repository } from 'typeorm';

import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { ConnectedAgentStatus } from 'src/engine/core-modules/connected-agent/enums/connected-agent-status.enum';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';

describe('ConnectedAgentService', () => {
  let service: ConnectedAgentService;
  let repository: jest.Mocked<Repository<ConnectedAgentEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectedAgentService,
        {
          provide: getRepositoryToken(ConnectedAgentEntity),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ConnectedAgentService);
    repository = module.get(getRepositoryToken(ConnectedAgentEntity));
  });

  it('should find an active agent scoped by apiKeyId and workspaceId', async () => {
    const agent = { id: 'agent-1', name: 'ProofBot' } as ConnectedAgentEntity;

    repository.findOne.mockResolvedValue(agent);

    const result = await service.findActiveByApiKeyId('key-1', 'ws-1');

    expect(result).toBe(agent);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: {
        apiKeyId: 'key-1',
        workspaceId: 'ws-1',
        status: ConnectedAgentStatus.ACTIVE,
        deletedAt: IsNull(),
      },
    });
  });

  it('should return null when no agent matches the api key', async () => {
    repository.findOne.mockResolvedValue(null);

    const result = await service.findActiveByApiKeyId('key-unknown', 'ws-1');

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=connected-agent.service`
Expected: FAIL — não consegue resolver `connected-agent.service`.

- [ ] **Step 3: Implementar o service**

Arquivo `packages/twenty-server/src/engine/core-modules/connected-agent/services/connected-agent.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { IsNull, Repository } from 'typeorm';

import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { ConnectedAgentStatus } from 'src/engine/core-modules/connected-agent/enums/connected-agent-status.enum';

@Injectable()
export class ConnectedAgentService {
  constructor(
    @InjectRepository(ConnectedAgentEntity)
    private readonly connectedAgentRepository: Repository<ConnectedAgentEntity>,
  ) {}

  async findActiveByApiKeyId(
    apiKeyId: string,
    workspaceId: string,
  ): Promise<ConnectedAgentEntity | null> {
    return this.connectedAgentRepository.findOne({
      where: {
        apiKeyId,
        workspaceId,
        status: ConnectedAgentStatus.ACTIVE,
        deletedAt: IsNull(),
      },
    });
  }
}
```

- [ ] **Step 4: Criar o módulo**

Arquivo `packages/twenty-server/src/engine/core-modules/connected-agent/connected-agent.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';

@Module({
  imports: [TypeOrmModule.forFeature([ConnectedAgentEntity])],
  providers: [ConnectedAgentService],
  exports: [ConnectedAgentService],
})
export class ConnectedAgentModule {}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=connected-agent.service`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
cd ~/Projetos/twenty
git add packages/twenty-server/src/engine/core-modules/connected-agent
git commit -m "feat(byoa): add ConnectedAgentService lookup by api key"
```

---

## Task 4: Ligar o `source: AGENT` no serviço central de proveniência

**Files:**
- Modify: `packages/twenty-server/src/engine/core-modules/actor/services/actor-from-auth-context.service.ts`
- Modify: `packages/twenty-server/src/engine/core-modules/actor/actor.module.ts`
- Test: `packages/twenty-server/src/engine/core-modules/actor/services/__tests__/actor-from-auth-context.service.spec.ts`

**Interfaces:**
- Consumes: `ConnectedAgentService.findActiveByApiKeyId` (Task 3), `buildCreatedByFromAgent` (Task 2), `buildCreatedByFromApiKey` (já existe).
- Produces: `ActorFromAuthContextService.buildActorMetadata` passa a ser `private async buildActorMetadata(authContext: WorkspaceAuthContext): Promise<ActorMetadata>`. Comportamento público (`injectCreatedBy`, `injectUpdatedBy`, `injectActorFieldsOnCreate`) permanece igual.

- [ ] **Step 1: Escrever o teste que falha**

Arquivo `packages/twenty-server/src/engine/core-modules/actor/services/__tests__/actor-from-auth-context.service.spec.ts`:

```ts
import { Test, type TestingModule } from '@nestjs/testing';

import { FieldActorSource } from 'twenty-shared/types';

import { ActorFromAuthContextService } from 'src/engine/core-modules/actor/services/actor-from-auth-context.service';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';
import { type ApiKeyWorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';

describe('ActorFromAuthContextService', () => {
  let service: ActorFromAuthContextService;
  let connectedAgentService: jest.Mocked<ConnectedAgentService>;

  const apiKeyAuthContext = {
    type: 'apiKey',
    workspace: { id: 'ws-1' },
    apiKey: { id: 'key-1', name: 'Raw API Key' },
  } as unknown as ApiKeyWorkspaceAuthContext;

  const buildActorMetadata = (authContext: ApiKeyWorkspaceAuthContext) =>
    (
      service as unknown as {
        buildActorMetadata: (
          ctx: ApiKeyWorkspaceAuthContext,
        ) => Promise<{ source: string; name: string; context: unknown }>;
      }
    ).buildActorMetadata(authContext);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActorFromAuthContextService,
        {
          provide: WorkspaceManyOrAllFlatEntityMapsCacheService,
          useValue: { getOrRecomputeManyOrAllFlatEntityMaps: jest.fn() },
        },
        {
          provide: ConnectedAgentService,
          useValue: { findActiveByApiKeyId: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ActorFromAuthContextService);
    connectedAgentService = module.get(ConnectedAgentService);
  });

  it('should stamp AGENT source when the api key belongs to a connected agent', async () => {
    connectedAgentService.findActiveByApiKeyId.mockResolvedValue({
      id: 'agent-1',
      name: 'ProofBot',
    } as never);

    const result = await buildActorMetadata(apiKeyAuthContext);

    expect(connectedAgentService.findActiveByApiKeyId).toHaveBeenCalledWith(
      'key-1',
      'ws-1',
    );
    expect(result).toEqual({
      source: FieldActorSource.AGENT,
      name: 'ProofBot',
      workspaceMemberId: null,
      context: { connectedAgentId: 'agent-1' },
    });
  });

  it('should fall back to API source when the api key is not a connected agent', async () => {
    connectedAgentService.findActiveByApiKeyId.mockResolvedValue(null);

    const result = await buildActorMetadata(apiKeyAuthContext);

    expect(result).toEqual({
      source: FieldActorSource.API,
      name: 'Raw API Key',
      workspaceMemberId: null,
      context: {},
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=actor-from-auth-context.service`
Expected: FAIL — `Nest can't resolve dependencies of ActorFromAuthContextService` (o `ConnectedAgentService` ainda não é uma dependência).

- [ ] **Step 3: Injetar o `ConnectedAgentService` e adicionar o ramo AGENT**

Em `packages/twenty-server/src/engine/core-modules/actor/services/actor-from-auth-context.service.ts`:

Adicionar os imports (junto aos imports existentes de `buildCreatedByFrom*`):

```ts
import { buildCreatedByFromAgent } from 'src/engine/core-modules/actor/utils/build-created-by-from-agent.util';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';
```

Substituir o constructor por:

```ts
  constructor(
    private readonly flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService,
    private readonly connectedAgentService: ConnectedAgentService,
  ) {}
```

Em `injectActorField`, trocar a linha:

```ts
    const actorMetadata = this.buildActorMetadata(authContext);
```

por:

```ts
    const actorMetadata = await this.buildActorMetadata(authContext);
```

Substituir o método `buildActorMetadata` inteiro por:

```ts
  private async buildActorMetadata(
    authContext: WorkspaceAuthContext,
  ): Promise<ActorMetadata> {
    if (isUserAuthContext(authContext)) {
      return buildCreatedByFromFullNameMetadata({
        fullNameMetadata: authContext.workspaceMember.name,
        workspaceMemberId: authContext.workspaceMemberId,
      });
    }

    if (isApiKeyAuthContext(authContext)) {
      const connectedAgent =
        await this.connectedAgentService.findActiveByApiKeyId(
          authContext.apiKey.id,
          authContext.workspace.id,
        );

      if (isDefined(connectedAgent)) {
        return buildCreatedByFromAgent({ connectedAgent });
      }

      return buildCreatedByFromApiKey({
        apiKey: authContext.apiKey,
      });
    }

    if (isApplicationAuthContext(authContext)) {
      return buildCreatedByFromApplication({
        application: authContext.application,
      });
    }

    throw new Error(
      'Unable to build actor metadata - no valid actor information found in auth context',
    );
  }
```

- [ ] **Step 4: Importar o `ConnectedAgentModule` no `ActorModule`**

Em `packages/twenty-server/src/engine/core-modules/actor/actor.module.ts`, adicionar o import:

```ts
import { ConnectedAgentModule } from 'src/engine/core-modules/connected-agent/connected-agent.module';
```

e incluí-lo no array `imports`:

```ts
  imports: [
    TypeOrmModule.forFeature([FieldMetadataEntity]),
    WorkspaceManyOrAllFlatEntityMapsCacheModule,
    ConnectedAgentModule,
  ],
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=actor-from-auth-context.service`
Expected: PASS (2 tests).

- [ ] **Step 6: Rodar os testes do módulo actor inteiro (não quebrar o existente)**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=core-modules/actor`
Expected: PASS — inclusive quaisquer specs de query-hooks existentes.

- [ ] **Step 7: Commit**

```bash
cd ~/Projetos/twenty
git add packages/twenty-server/src/engine/core-modules/actor
git commit -m "feat(byoa): stamp source AGENT when api key belongs to a connected agent"
```

---

## Task 5: Provisionamento — criar agente + API key + token

**Files:**
- Create: `packages/twenty-server/src/engine/core-modules/connected-agent/services/connected-agent-provisioning.service.ts`
- Create: `packages/twenty-server/src/engine/core-modules/connected-agent/dtos/create-connected-agent.input.ts`
- Create: `packages/twenty-server/src/engine/core-modules/connected-agent/dtos/connected-agent-with-token.dto.ts`
- Create: `packages/twenty-server/src/engine/core-modules/connected-agent/connected-agent.resolver.ts`
- Create: `packages/twenty-server/src/engine/core-modules/connected-agent/connected-agent-provisioning.module.ts`
- Test: `packages/twenty-server/src/engine/core-modules/connected-agent/services/__tests__/connected-agent-provisioning.service.spec.ts`

**Interfaces:**
- Consumes: `ApiKeyService.create({ name, expiresAt, workspaceId, roleId }): Promise<ApiKeyEntity>` e `ApiKeyService.generateApiKeyToken(workspaceId, apiKeyId, expiresAt?): Promise<{ token: string } | undefined>` (ambos já existem em `src/engine/core-modules/api-key/services/api-key.service`); `ConnectedAgentEntity` (Task 1).
- Produces: `ConnectedAgentProvisioningService.provisionConnectedAgent({ name, description, roleId, workspaceId, expiresAt }): Promise<{ connectedAgent: ConnectedAgentEntity; token: string }>`.

- [ ] **Step 1: Escrever o teste que falha**

Arquivo `packages/twenty-server/src/engine/core-modules/connected-agent/services/__tests__/connected-agent-provisioning.service.spec.ts`:

```ts
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { ConnectedAgentProvisioningService } from 'src/engine/core-modules/connected-agent/services/connected-agent-provisioning.service';

describe('ConnectedAgentProvisioningService', () => {
  let service: ConnectedAgentProvisioningService;
  let apiKeyService: jest.Mocked<ApiKeyService>;
  let repository: jest.Mocked<Repository<ConnectedAgentEntity>>;

  const expiresAt = new Date('2027-01-01T00:00:00.000Z');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectedAgentProvisioningService,
        {
          provide: ApiKeyService,
          useValue: {
            create: jest.fn(),
            generateApiKeyToken: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ConnectedAgentEntity),
          useValue: { save: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ConnectedAgentProvisioningService);
    apiKeyService = module.get(ApiKeyService);
    repository = module.get(getRepositoryToken(ConnectedAgentEntity));
  });

  it('should create an api key with the role, persist the agent and return the token once', async () => {
    apiKeyService.create.mockResolvedValue({ id: 'key-1' } as never);
    apiKeyService.generateApiKeyToken.mockResolvedValue({ token: 'jwt-token' });
    repository.save.mockImplementation(
      async (agent) => ({ id: 'agent-1', ...agent }) as never,
    );

    const result = await service.provisionConnectedAgent({
      name: 'ProofBot',
      description: 'my agent',
      roleId: 'role-1',
      workspaceId: 'ws-1',
      expiresAt,
    });

    expect(apiKeyService.create).toHaveBeenCalledWith({
      name: 'ProofBot',
      expiresAt,
      workspaceId: 'ws-1',
      roleId: 'role-1',
    });
    expect(apiKeyService.generateApiKeyToken).toHaveBeenCalledWith(
      'ws-1',
      'key-1',
      expiresAt,
    );
    expect(repository.save).toHaveBeenCalledWith({
      name: 'ProofBot',
      description: 'my agent',
      apiKeyId: 'key-1',
      workspaceId: 'ws-1',
    });
    expect(result.token).toBe('jwt-token');
    expect(result.connectedAgent.id).toBe('agent-1');
  });

  it('should throw when the token could not be generated', async () => {
    apiKeyService.create.mockResolvedValue({ id: 'key-1' } as never);
    apiKeyService.generateApiKeyToken.mockResolvedValue(undefined);

    await expect(
      service.provisionConnectedAgent({
        name: 'ProofBot',
        description: null,
        roleId: 'role-1',
        workspaceId: 'ws-1',
        expiresAt,
      }),
    ).rejects.toThrow('Failed to generate token for connected agent');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=connected-agent-provisioning.service`
Expected: FAIL — não consegue resolver `connected-agent-provisioning.service`.

- [ ] **Step 3: Implementar o service de provisionamento**

Arquivo `packages/twenty-server/src/engine/core-modules/connected-agent/services/connected-agent-provisioning.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';

type ProvisionConnectedAgentArgs = {
  name: string;
  description: string | null;
  roleId: string;
  workspaceId: string;
  expiresAt: Date;
};

type ProvisionConnectedAgentResult = {
  connectedAgent: ConnectedAgentEntity;
  token: string;
};

@Injectable()
export class ConnectedAgentProvisioningService {
  constructor(
    @InjectRepository(ConnectedAgentEntity)
    private readonly connectedAgentRepository: Repository<ConnectedAgentEntity>,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async provisionConnectedAgent({
    name,
    description,
    roleId,
    workspaceId,
    expiresAt,
  }: ProvisionConnectedAgentArgs): Promise<ProvisionConnectedAgentResult> {
    const apiKey = await this.apiKeyService.create({
      name,
      expiresAt,
      workspaceId,
      roleId,
    });

    const apiKeyToken = await this.apiKeyService.generateApiKeyToken(
      workspaceId,
      apiKey.id,
      expiresAt,
    );

    if (!apiKeyToken) {
      throw new Error('Failed to generate token for connected agent');
    }

    const connectedAgent = await this.connectedAgentRepository.save({
      name,
      description,
      apiKeyId: apiKey.id,
      workspaceId,
    });

    return { connectedAgent, token: apiKeyToken.token };
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=connected-agent-provisioning.service`
Expected: PASS (2 tests).

- [ ] **Step 5: Criar os DTOs**

Arquivo `packages/twenty-server/src/engine/core-modules/connected-agent/dtos/create-connected-agent.input.ts`:

```ts
import { Field, InputType } from '@nestjs/graphql';

import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@InputType()
export class CreateConnectedAgentInput {
  @Field(() => String)
  @IsString()
  name: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field(() => UUIDScalarType)
  @IsUUID()
  roleId: string;

  @Field(() => String)
  @IsDateString()
  expiresAt: string;
}
```

Arquivo `packages/twenty-server/src/engine/core-modules/connected-agent/dtos/connected-agent-with-token.dto.ts`:

```ts
import { Field, ObjectType } from '@nestjs/graphql';

import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';

@ObjectType('ConnectedAgentWithToken')
export class ConnectedAgentWithTokenDTO {
  @Field(() => ConnectedAgentEntity)
  connectedAgent: ConnectedAgentEntity;

  @Field(() => String, {
    description: 'Only returned once, at creation time. Store it securely.',
  })
  token: string;
}
```

- [ ] **Step 6: Criar o resolver**

Arquivo `packages/twenty-server/src/engine/core-modules/connected-agent/connected-agent.resolver.ts`:

```ts
import { UseGuards } from '@nestjs/common';
import { Args, Mutation } from '@nestjs/graphql';

import { PermissionFlagType } from 'twenty-shared/constants';

import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { ConnectedAgentWithTokenDTO } from 'src/engine/core-modules/connected-agent/dtos/connected-agent-with-token.dto';
import { CreateConnectedAgentInput } from 'src/engine/core-modules/connected-agent/dtos/create-connected-agent.input';
import { ConnectedAgentProvisioningService } from 'src/engine/core-modules/connected-agent/services/connected-agent-provisioning.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@MetadataResolver(() => ConnectedAgentEntity)
@UseGuards(
  WorkspaceAuthGuard,
  SettingsPermissionGuard(PermissionFlagType.API_KEYS_AND_WEBHOOKS),
)
export class ConnectedAgentResolver {
  constructor(
    private readonly connectedAgentProvisioningService: ConnectedAgentProvisioningService,
  ) {}

  @Mutation(() => ConnectedAgentWithTokenDTO)
  async createConnectedAgent(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('input') input: CreateConnectedAgentInput,
  ): Promise<ConnectedAgentWithTokenDTO> {
    return this.connectedAgentProvisioningService.provisionConnectedAgent({
      name: input.name,
      description: input.description ?? null,
      roleId: input.roleId,
      workspaceId: workspace.id,
      expiresAt: new Date(input.expiresAt),
    });
  }
}
```

> **Por que `@MetadataResolver` e não `@Resolver`:** o Twenty separa os schemas GraphQL; resolvers de
> configuração (como `ApiKeyResolver`) usam `@MetadataResolver` para entrar no schema de metadata.
> Um `@Resolver()` simples não apareceria na API correta.
>
> **Por que `SettingsPermissionGuard(API_KEYS_AND_WEBHOOKS)`:** esta mutation **emite uma API key**,
> logo exige a mesma permissão de quem cria API keys. Sem esse guard, qualquer membro do workspace
> conseguiria mintar um token de agente.

- [ ] **Step 7: Criar o módulo de provisionamento**

Arquivo `packages/twenty-server/src/engine/core-modules/connected-agent/connected-agent-provisioning.module.ts`:

```ts
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
```

- [ ] **Step 8: Registrar o módulo na aplicação**

Abrir `packages/twenty-server/src/engine/core-modules/core-engine.module.ts`. O `ApiKeyModule` já está
listado no array `imports` (por volta da linha 161) — adicionar `ConnectedAgentProvisioningModule`
logo em seguida, e incluir o import no topo:

```ts
import { ConnectedAgentProvisioningModule } from 'src/engine/core-modules/connected-agent/connected-agent-provisioning.module';
```

- [ ] **Step 9: Verificar que o servidor sobe (schema GraphQL válido)**

Run: `cd ~/Projetos/twenty && npx nx run twenty-server:build`
Expected: build sem erro de tipo nem de dependência do Nest.

- [ ] **Step 10: Commit**

```bash
cd ~/Projetos/twenty
git add packages/twenty-server/src/engine/core-modules/connected-agent packages/twenty-server/src/engine/core-modules/core-engine.module.ts
git commit -m "feat(byoa): provision connected agent with api key and one-time token"
```

---

## Task 6: Verificação end-to-end (agente real escrevendo no CRM)

**Files:**
- Nenhum arquivo de produção. Verificação manual do critério de pronto do M1.

**Interfaces:**
- Consumes: mutation `createConnectedAgent` (Task 5); proveniência AGENT (Task 4).
- Produces: evidência de que `createdBy` e `updatedBy` de um registro escrito pelo agente têm `source = AGENT`.

- [ ] **Step 1: Subir o ambiente**

Run: `cd ~/Projetos/twenty && yarn start`
Expected: server responde em `http://localhost:3000/healthz` com 200; front em `http://localhost:3001`.
(Postgres Homebrew na :5432 e Redis na :6379 precisam estar rodando — `brew services list`.)

- [ ] **Step 2: Obter um `roleId` existente**

Run: `psql -d default -tAc "select id, label from core.role limit 5;"`
Expected: ao menos uma role. Anotar o `id` de uma role com permissão de escrita.

- [ ] **Step 3: Criar o agente via GraphQL e capturar o token**

Fazer login na UI (`http://localhost:3001`, `alexandre@desenro.la`), abrir o DevTools → Network, copiar o `Authorization: Bearer <accessToken>` de qualquer request GraphQL, e rodar:

```bash
curl -s http://localhost:3000/graphql \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer <ACCESS_TOKEN_DO_USUARIO>" \
  -d '{"query":"mutation($input: CreateConnectedAgentInput!){ createConnectedAgent(input:$input){ token connectedAgent { id name } } }","variables":{"input":{"name":"ProofBot","roleId":"<ROLE_ID>","expiresAt":"2027-01-01T00:00:00.000Z"}}}'
```

Expected: JSON com `connectedAgent.name = "ProofBot"` e um `token`. Guardar o token como `AGENT_TOKEN`.

- [ ] **Step 4: Criar um registro usando o token do agente**

```bash
curl -s -X POST http://localhost:3000/rest/companies \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer <AGENT_TOKEN>" \
  -d '{"name":"BYOA Test Co"}'
```

Expected: 200/201 com o registro criado.

- [ ] **Step 5: Conferir a proveniência de criação no banco**

Run: `psql -d default -tAc "select name, \"createdBySource\", \"createdByName\" from workspace_1v5uuujmzyslpx3t7687wtv2f.company where name='BYOA Test Co';"`
Expected: `BYOA Test Co|AGENT|ProofBot`

- [ ] **Step 6: Editar o registro com o token do agente e conferir `updatedBy`**

```bash
curl -s -X PATCH "http://localhost:3000/rest/companies/<COMPANY_ID>" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer <AGENT_TOKEN>" \
  -d '{"name":"BYOA Test Co (edited)"}'
```

Run: `psql -d default -tAc "select \"updatedBySource\", \"updatedByName\" from workspace_1v5uuujmzyslpx3t7687wtv2f.company where id='<COMPANY_ID>';"`
Expected: `AGENT|ProofBot`

- [ ] **Step 7: Conferir a não-regressão de API key comum**

Criar uma API key pela UI (Settings → Developers → API Keys), usar o token dela num `POST /rest/companies` e conferir:
Expected: `createdBySource = API` (e **não** `AGENT`), provando que só agentes registrados viram `AGENT`.

- [ ] **Step 8: Conferir na UI**

Abrir o registro "BYOA Test Co (edited)" em `http://localhost:3001`.
Expected: o campo de criação/atualização mostra **ProofBot** como autor.

- [ ] **Step 9: Limpar o registro de teste**

```bash
curl -s -X DELETE "http://localhost:3000/rest/companies/<COMPANY_ID>" \
  -H "Authorization: Bearer <AGENT_TOKEN>"
```

- [ ] **Step 10: Commit da documentação de verificação**

Anexar a evidência (saídas dos steps 5, 6 e 7) ao final do spec, em uma seção `## Verificação M1`, e commitar:

```bash
cd ~/Projetos/twenty
git add docs/superpowers/specs/2026-07-16-byoa-agent-bridge-design.md
git commit -m "docs(byoa): record M1 end-to-end verification results"
```

---

## Critério de pronto do M1

Um registro criado **e** editado por um agente com token mostra `source = AGENT` e o nome do agente
em `createdBy`/`updatedBy` — no banco e na UI — enquanto API keys comuns seguem com `source = API`.

## Notas para M2/M3 (não implementar agora)

- **Lacuna consciente vs. spec:** o spec do M1 diz "serviço CRUD". Este plano entrega apenas
  **create** (provisionamento) e **read** (`findActiveByApiKeyId`). `list`, `update` e `disable`
  ficam para o **M3**, que é quem precisa deles (a UI). Não são necessários para o critério de
  pronto do M1.
- `lastSeenAt` já existe na entidade, mas só será populado no M2 (heartbeat do agent-bridge).
- `status: DISABLED` já é respeitado pelo `findActiveByApiKeyId` (agente desativado volta a carimbar `API`).
- A tabela `core.agentActivity` e as rotas `/agent-bridge/*` são do M2.
