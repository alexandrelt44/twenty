# BYOA M2 — Agent Bridge (conexão + presença + atividade + gate de escrita) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um agente externo se **conecta** ao bridge (handshake), mantém **presença** por heartbeat, reporta **atividade** (feed), e suas **escritas no CRM ficam bloqueadas sem sessão ativa** — enquanto leituras e usuários/API keys comuns seguem intactos.

**Architecture:** Um controller HTTP novo `engine/api/agent-bridge` (autenticado por API key via os guards do MCP: `JwtAuthGuard` + `WorkspaceAuthGuard`, sem mexer no `app.module`) expõe `connect`/`heartbeat`/`events`. Conexão/heartbeat/events atualizam `ConnectedAgent.lastSeenAt` (a "sessão" = `lastSeenAt` dentro de um TTL). Um conjunto de **pre-query hooks** de escrita (`AgentSessionGate*`) roda no mesmo chokepoint do ORM que o M1 e **lança `PermissionsException(PERMISSION_DENIED)`** quando o autor é um `ConnectedAgent` ACTIVE com sessão expirada. Feed de atividade em `core.agentActivity`.

**Tech Stack:** NestJS, TypeORM (schema `core`), Jest (`@swc/jest`), GraphQL, Nx monorepo. Depende do M1 (branch `dev`, entidade `ConnectedAgent`, `ConnectedAgentService`, proveniência AGENT).

## Global Constraints

- Repo: `~/Projetos/twenty`, branch `dev` (fork `alexandrelt44/twenty`). Commitar nesta branch. M1 já está mergeado nela.
- Spec: `docs/superpowers/specs/2026-07-16-byoa-agent-bridge-design.md` (seção M2).
- **Decisões travadas (aprovadas):** (a) o bridge **gate obrigatório nas escritas** — sem sessão ativa, escrita do agente é bloqueada; (b) `agentActivity` do M2 registra **só o auto-reportado via `/events`** (não auto-deriva de audit); (c) **sem** endpoint `/state` (YAGNI); (d) `connect` devolve **identidade do agente + id/nome da role**, sem serializar permissões finas.
- **Sessão = `ConnectedAgent.lastSeenAt` (coluna já existe do M1) dentro de TTL.** `connect`/`heartbeat`/`events` setam `lastSeenAt = now`. Sessão ativa ⇔ `now - lastSeenAt < AGENT_SESSION_TTL_MS`. **TTL = 5 min (300_000 ms)**, constante exportada. Escritas NÃO renovam a sessão (evita 1 write/op); o heartbeat mantém viva.
- **Gate só afeta escrita de agente.** Usuário e API key comum: nunca gateados. Leituras (`findMany/findOne`): nunca gateadas. Agente DISABLED: `findActiveByApiKeyId` retorna null (só ACTIVE), então cai no caminho "não-agente" e **não** é gateado (coerente com M1: age como API key comum).
- **Throw do gate:** `PermissionsException(msg, PermissionsExceptionCode.PERMISSION_DENIED)` de `src/engine/metadata-modules/permissions/permissions.exception` — o handler do workspace query runner já a mapeia (`workspace-query-runner-graphql-api-exception-handler.util.ts`), surge como erro de permissão em REST e GraphQL.
- **Auth do bridge:** guards `JwtAuthGuard` + `WorkspaceAuthGuard` (mesmo padrão do `McpModule`) → populam `req.apiKey`/`req.workspace`; decorators `@AuthApiKey()`/`@AuthWorkspace()` extraem. NÃO adicionar middleware no `app.module`.
- **`ActorMetadata['context']`** já tem `connectedAgentId?` (do M1). Nada a mudar lá.
- Testes: `cd packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=<padrão>` (~1-2s). **NUNCA** `npx nx test` (ignora o filtro, roda ~224s).
- Typecheck (jest usa `@swc/jest`, que NÃO checa tipos): `cd packages/twenty-server && npx tsc --noEmit -p tsconfig.json --skipLibCheck 2>&1 | grep <arquivo>`. Erros pré-existentes NÃO relacionados: `@file-type/pdf`, `is-psl-parsed-domain` — ignorar.
- Migrations: `npx nx run twenty-server:database:migrate`. Build+DI só valida no BOOT (`nx build` não pega erro de DI) — o boot é verificado na Task 5.
- Imports usam alias `src/...`. Resolvers/entidades seguem os padrões do M1 e dos siblings (`api-key`, `mcp`).

---

## File Structure

**Criar:**
- `packages/twenty-server/src/engine/core-modules/connected-agent/enums/agent-activity-type.enum.ts` — enum `AgentActivityType`.
- `packages/twenty-server/src/engine/core-modules/connected-agent/agent-activity.entity.ts` — entidade `core.agentActivity`.
- `packages/twenty-server/src/database/typeorm/core/migrations/common/1784400000000-add-agent-activity.ts` — migration.
- `packages/twenty-server/src/engine/core-modules/connected-agent/services/agent-activity.service.ts` — insert + list de atividade.
- `packages/twenty-server/src/engine/core-modules/connected-agent/constants/agent-session.const.ts` — `AGENT_SESSION_TTL_MS`.
- `packages/twenty-server/src/engine/core-modules/connected-agent/services/agent-session-guard.service.ts` — `assertActiveSession(authContext)` + `isSessionActive`.
- `packages/twenty-server/src/engine/core-modules/connected-agent/query-hooks/agent-session-gate.create-one.pre-query-hook.ts` (+ `create-many`, `update-one`, `update-many`, `delete-one`, `delete-many`) — 6 hooks finos.
- `packages/twenty-server/src/engine/core-modules/connected-agent/agent-session-guard.module.ts` — módulo que provê o gate service + os 6 hooks.
- `packages/twenty-server/src/engine/api/agent-bridge/dtos/agent-bridge-connect.dto.ts` — resposta do connect.
- `packages/twenty-server/src/engine/api/agent-bridge/dtos/report-agent-event.input.ts` — body de `/events`.
- `packages/twenty-server/src/engine/api/agent-bridge/guards/agent-bridge.guard.ts` — exige `ConnectedAgent` ACTIVE.
- `packages/twenty-server/src/engine/api/agent-bridge/services/agent-bridge.service.ts` — lógica de connect/heartbeat/events.
- `packages/twenty-server/src/engine/api/agent-bridge/controllers/agent-bridge.controller.ts` — os 3 endpoints.
- `packages/twenty-server/src/engine/api/agent-bridge/agent-bridge.module.ts` — módulo do bridge.

**Modificar:**
- `packages/twenty-server/src/engine/core-modules/connected-agent/services/connected-agent.service.ts` — add `touchLastSeen(id, workspaceId)`.
- `packages/twenty-server/src/engine/core-modules/connected-agent/connected-agent.module.ts` — registrar `AgentActivityEntity` no `forFeature` e exportar os novos services (ver Task 2/3).
- `packages/twenty-server/src/engine/core-modules/core-engine.module.ts` — importar `AgentSessionGuardModule` (pros hooks ficarem ativos, como o `ActorModule` que já está lá).
- `packages/twenty-server/src/app.module.ts` — registrar `AgentBridgeModule` (módulo de API HTTP, junto do `McpModule`).
- `packages/twenty-server/@types/express.d.ts` — augmentar `Request` com `connectedAgent?`.

**Testes:** ao lado de cada service/hook em `__tests__/`.

---

## Task 1: Entidade `AgentActivity` + migration

**Files:**
- Create: `packages/twenty-server/src/engine/core-modules/connected-agent/enums/agent-activity-type.enum.ts`
- Create: `packages/twenty-server/src/engine/core-modules/connected-agent/agent-activity.entity.ts`
- Create: `packages/twenty-server/src/database/typeorm/core/migrations/common/1784400000000-add-agent-activity.ts`

**Interfaces:**
- Consumes: `WorkspaceRelatedEntity`, `ConnectedAgentEntity` (M1, `core.connectedAgent`).
- Produces: `AgentActivityEntity` (`id`, `workspaceId`, `connectedAgentId`, `type: AgentActivityType`, `summary: string`, `payload: Record<string,unknown> | null`, `createdAt`); `enum AgentActivityType { PROMPT, ACTION, NOTE }`.

- [ ] **Step 1: Criar o enum**

`packages/twenty-server/src/engine/core-modules/connected-agent/enums/agent-activity-type.enum.ts`:

```ts
import { registerEnumType } from '@nestjs/graphql';

export enum AgentActivityType {
  PROMPT = 'PROMPT',
  ACTION = 'ACTION',
  NOTE = 'NOTE',
}

registerEnumType(AgentActivityType, {
  name: 'AgentActivityType',
});
```

- [ ] **Step 2: Criar a entidade**

`packages/twenty-server/src/engine/core-modules/connected-agent/agent-activity.entity.ts`:

```ts
import { Field, ObjectType } from '@nestjs/graphql';

import { IDField } from '@ptc-org/nestjs-query-graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { AgentActivityType } from 'src/engine/core-modules/connected-agent/enums/agent-activity-type.enum';
import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

@Index('IDX_AGENT_ACTIVITY_WORKSPACE_ID', ['workspaceId'])
@Index('IDX_AGENT_ACTIVITY_CONNECTED_AGENT_ID', ['connectedAgentId'])
@Entity({ name: 'agentActivity', schema: 'core' })
@ObjectType('AgentActivity')
export class AgentActivityEntity extends WorkspaceRelatedEntity {
  @IDField(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  connectedAgentId: string;

  @ManyToOne(() => ConnectedAgentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connectedAgentId' })
  connectedAgent: Relation<ConnectedAgentEntity>;

  @Field(() => AgentActivityType)
  @Column({ type: 'text' })
  type: AgentActivityType;

  @Field()
  @Column({ type: 'text' })
  summary: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @Field(() => Date)
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
```

- [ ] **Step 3: Criar a migration**

`packages/twenty-server/src/database/typeorm/core/migrations/common/1784400000000-add-agent-activity.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgentActivity1784400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."agentActivity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "connectedAgentId" uuid NOT NULL, "type" text NOT NULL, "summary" text NOT NULL, "payload" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_AGENT_ACTIVITY_ID" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_ACTIVITY_WORKSPACE_ID" ON "core"."agentActivity" ("workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_ACTIVITY_CONNECTED_AGENT_ID" ON "core"."agentActivity" ("connectedAgentId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."agentActivity" ADD CONSTRAINT "FK_AGENT_ACTIVITY_WORKSPACE_ID" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."agentActivity" ADD CONSTRAINT "FK_AGENT_ACTIVITY_CONNECTED_AGENT_ID" FOREIGN KEY ("connectedAgentId") REFERENCES "core"."connectedAgent"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "core"."agentActivity"`);
  }
}
```

> Nota (dívida técnica já aceita no M1): nomear PK/FK à mão diverge da convenção hash do TypeORM. Mantido por consistência com a migration do M1; sem impacto de runtime.

- [ ] **Step 4: Rodar a migration**

Run: `cd ~/Projetos/twenty && npx nx run twenty-server:database:migrate`
Expected: build + execução sem erro; `AddAgentActivity1784400000000` executada.

- [ ] **Step 5: Verificar a tabela**

Run: `psql -d default -tAc "select column_name from information_schema.columns where table_schema='core' and table_name='agentActivity' order by ordinal_position;"`
Expected: `id, workspaceId, connectedAgentId, type, summary, payload, createdAt`.

- [ ] **Step 6: Commit**

```bash
cd ~/Projetos/twenty
git add packages/twenty-server/src/engine/core-modules/connected-agent/enums/agent-activity-type.enum.ts packages/twenty-server/src/engine/core-modules/connected-agent/agent-activity.entity.ts packages/twenty-server/src/database/typeorm/core/migrations/common/1784400000000-add-agent-activity.ts
git commit -m "feat(byoa): add agentActivity entity and migration"
```

---

## Task 2: `touchLastSeen` + `AgentActivityService`

**Files:**
- Modify: `packages/twenty-server/src/engine/core-modules/connected-agent/services/connected-agent.service.ts`
- Create: `packages/twenty-server/src/engine/core-modules/connected-agent/services/agent-activity.service.ts`
- Modify: `packages/twenty-server/src/engine/core-modules/connected-agent/connected-agent.module.ts`
- Test: `packages/twenty-server/src/engine/core-modules/connected-agent/services/__tests__/agent-activity.service.spec.ts`
- Test: adicionar caso a `.../services/__tests__/connected-agent.service.spec.ts` (existe do M1)

**Interfaces:**
- Consumes: `ConnectedAgentEntity`, `AgentActivityEntity`, `AgentActivityType`.
- Produces:
  - `ConnectedAgentService.touchLastSeen(connectedAgentId: string, workspaceId: string): Promise<void>` — seta `lastSeenAt = new Date()`.
  - `AgentActivityService.record({ connectedAgentId, workspaceId, type, summary, payload }): Promise<AgentActivityEntity>`.
  - `AgentActivityService.listForAgent(connectedAgentId: string, workspaceId: string, limit?: number): Promise<AgentActivityEntity[]>` (ordenado por `createdAt` desc; limit default 50).
  - `ConnectedAgentModule` passa a registrar `AgentActivityEntity` no `forFeature` e a exportar `ConnectedAgentService` + `AgentActivityService`.

- [ ] **Step 1: Escrever o teste de `touchLastSeen` (adicionar ao spec do M1)**

Adicionar em `.../connected-agent/services/__tests__/connected-agent.service.spec.ts` um novo `describe`:

```ts
  describe('touchLastSeen', () => {
    it('should set lastSeenAt to now for the given agent scoped by workspace', async () => {
      const update = repository.update as jest.Mock;

      await service.touchLastSeen('agent-1', 'ws-1');

      expect(update).toHaveBeenCalledWith(
        { id: 'agent-1', workspaceId: 'ws-1' },
        { lastSeenAt: expect.any(Date) },
      );
    });
  });
```

> O mock do repositório do spec do M1 provê `findOne`; adicione `update: jest.fn()` ao `useValue` do `getRepositoryToken(ConnectedAgentEntity)` provider (não remova o `findOne`).

- [ ] **Step 2: Rodar → falha (método não existe)**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=connected-agent.service`
Expected: FAIL no novo teste (`service.touchLastSeen is not a function`).

- [ ] **Step 3: Implementar `touchLastSeen`**

Em `connected-agent.service.ts`, adicionar o método na classe (mantendo o `findActiveByApiKeyId` existente):

```ts
  async touchLastSeen(
    connectedAgentId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.connectedAgentRepository.update(
      { id: connectedAgentId, workspaceId },
      { lastSeenAt: new Date() },
    );
  }
```

- [ ] **Step 4: Rodar → passa**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=connected-agent.service`
Expected: todos os testes (M1 + novo) passam.

- [ ] **Step 5: Escrever o teste do `AgentActivityService`**

`.../connected-agent/services/__tests__/agent-activity.service.spec.ts`:

```ts
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { AgentActivityEntity } from 'src/engine/core-modules/connected-agent/agent-activity.entity';
import { AgentActivityType } from 'src/engine/core-modules/connected-agent/enums/agent-activity-type.enum';
import { AgentActivityService } from 'src/engine/core-modules/connected-agent/services/agent-activity.service';

describe('AgentActivityService', () => {
  let service: AgentActivityService;
  let repository: jest.Mocked<Repository<AgentActivityEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentActivityService,
        {
          provide: getRepositoryToken(AgentActivityEntity),
          useValue: { save: jest.fn(), find: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AgentActivityService);
    repository = module.get(getRepositoryToken(AgentActivityEntity));
  });

  it('should persist an activity with the given fields', async () => {
    repository.save.mockImplementation(async (a) => ({ id: 'act-1', ...a }) as never);

    const result = await service.record({
      connectedAgentId: 'agent-1',
      workspaceId: 'ws-1',
      type: AgentActivityType.PROMPT,
      summary: 'received a prompt',
      payload: { foo: 'bar' },
    });

    expect(repository.save).toHaveBeenCalledWith({
      connectedAgentId: 'agent-1',
      workspaceId: 'ws-1',
      type: AgentActivityType.PROMPT,
      summary: 'received a prompt',
      payload: { foo: 'bar' },
    });
    expect(result.id).toBe('act-1');
  });

  it('should list activity for an agent scoped by workspace, newest first', async () => {
    const rows = [{ id: 'act-2' }] as AgentActivityEntity[];

    repository.find.mockResolvedValue(rows);

    const result = await service.listForAgent('agent-1', 'ws-1', 10);

    expect(repository.find).toHaveBeenCalledWith({
      where: { connectedAgentId: 'agent-1', workspaceId: 'ws-1' },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    expect(result).toBe(rows);
  });
});
```

- [ ] **Step 6: Rodar → falha (módulo não existe)**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=agent-activity.service`
Expected: FAIL (cannot resolve `agent-activity.service`).

- [ ] **Step 7: Implementar `AgentActivityService`**

`.../connected-agent/services/agent-activity.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { AgentActivityEntity } from 'src/engine/core-modules/connected-agent/agent-activity.entity';
import { AgentActivityType } from 'src/engine/core-modules/connected-agent/enums/agent-activity-type.enum';

type RecordActivityArgs = {
  connectedAgentId: string;
  workspaceId: string;
  type: AgentActivityType;
  summary: string;
  payload?: Record<string, unknown> | null;
};

@Injectable()
export class AgentActivityService {
  constructor(
    @InjectRepository(AgentActivityEntity)
    private readonly agentActivityRepository: Repository<AgentActivityEntity>,
  ) {}

  async record({
    connectedAgentId,
    workspaceId,
    type,
    summary,
    payload = null,
  }: RecordActivityArgs): Promise<AgentActivityEntity> {
    return this.agentActivityRepository.save({
      connectedAgentId,
      workspaceId,
      type,
      summary,
      payload,
    });
  }

  async listForAgent(
    connectedAgentId: string,
    workspaceId: string,
    limit = 50,
  ): Promise<AgentActivityEntity[]> {
    return this.agentActivityRepository.find({
      where: { connectedAgentId, workspaceId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
```

> Nota: no teste, `record` é chamado sem `payload` em alguns fluxos; o default `= null` cobre isso. O teste passa `payload: { foo: 'bar' }` explicitamente e espera-o no `save`.

- [ ] **Step 8: Registrar no `ConnectedAgentModule`**

Em `connected-agent.module.ts`: adicionar `AgentActivityEntity` ao `forFeature`, `AgentActivityService` a `providers` e `exports`. Resultado:

```ts
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
```

> Constraint do M1 preservada: o módulo continua **sem importar `ApiKeyModule` nem outro feature module** (evita ciclo com `ActorModule`, que importa este). Só ganhou uma entidade e um service.

- [ ] **Step 9: Rodar os dois specs + tsc**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns='connected-agent.service|agent-activity.service'`
Expected: todos passam.
Run: `cd ~/Projetos/twenty/packages/twenty-server && npx tsc --noEmit -p tsconfig.json --skipLibCheck 2>&1 | grep -E "connected-agent|agent-activity"`
Expected: sem erros dos seus arquivos.

- [ ] **Step 10: Commit**

```bash
cd ~/Projetos/twenty
git add packages/twenty-server/src/engine/core-modules/connected-agent
git commit -m "feat(byoa): add touchLastSeen and AgentActivityService"
```

---

## Task 3: Gate de sessão (pre-query hooks + service)

**Files:**
- Create: `packages/twenty-server/src/engine/core-modules/connected-agent/constants/agent-session.const.ts`
- Create: `packages/twenty-server/src/engine/core-modules/connected-agent/services/agent-session-guard.service.ts`
- Create: os 6 hooks em `.../connected-agent/query-hooks/agent-session-gate.<op>.pre-query-hook.ts`
- Create: `packages/twenty-server/src/engine/core-modules/connected-agent/agent-session-guard.module.ts`
- Modify: `packages/twenty-server/src/engine/core-modules/core-engine.module.ts` (importar o módulo)
- Test: `.../connected-agent/services/__tests__/agent-session-guard.service.spec.ts`

**Interfaces:**
- Consumes: `ConnectedAgentService.findActiveByApiKeyId` (M1), `WorkspaceAuthContext`, `isApiKeyAuthContext` (`src/engine/core-modules/auth/guards/is-api-key-auth-context.guard`), `PermissionsException`/`PermissionsExceptionCode`.
- Produces: `AGENT_SESSION_TTL_MS = 300_000`; `AgentSessionGuardService.assertActiveSession(authContext: WorkspaceAuthContext): Promise<void>` (no-op se não for agente; lança `PermissionsException(PERMISSION_DENIED)` se agente com sessão expirada); `AgentSessionGuardService.isSessionActive(lastSeenAt: Date | null): boolean`.

- [ ] **Step 1: Constante do TTL**

`.../connected-agent/constants/agent-session.const.ts`:

```ts
// A connected agent's bridge session is considered active if its lastSeenAt
// (refreshed by connect/heartbeat/events) is within this window. Writes by an
// agent whose session has lapsed are rejected until it reconnects.
export const AGENT_SESSION_TTL_MS = 300_000; // 5 minutes
```

- [ ] **Step 2: Escrever o teste do gate service**

`.../connected-agent/services/__tests__/agent-session-guard.service.spec.ts`:

```ts
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
```

- [ ] **Step 3: Rodar → falha**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=agent-session-guard.service`
Expected: FAIL (cannot resolve `agent-session-guard.service`).

- [ ] **Step 4: Implementar o gate service**

`.../connected-agent/services/agent-session-guard.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

import { AGENT_SESSION_TTL_MS } from 'src/engine/core-modules/connected-agent/constants/agent-session.const';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';
import { isApiKeyAuthContext } from 'src/engine/core-modules/auth/guards/is-api-key-auth-context.guard';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import {
  PermissionsException,
  PermissionsExceptionCode,
} from 'src/engine/metadata-modules/permissions/permissions.exception';

@Injectable()
export class AgentSessionGuardService {
  constructor(
    private readonly connectedAgentService: ConnectedAgentService,
  ) {}

  isSessionActive(lastSeenAt: Date | null): boolean {
    if (lastSeenAt === null) {
      return false;
    }

    return Date.now() - new Date(lastSeenAt).getTime() < AGENT_SESSION_TTL_MS;
  }

  async assertActiveSession(authContext: WorkspaceAuthContext): Promise<void> {
    if (!isApiKeyAuthContext(authContext)) {
      return;
    }

    const connectedAgent =
      await this.connectedAgentService.findActiveByApiKeyId(
        authContext.apiKey.id,
        authContext.workspace.id,
      );

    if (connectedAgent === null) {
      return;
    }

    if (!this.isSessionActive(connectedAgent.lastSeenAt)) {
      throw new PermissionsException(
        'Agent must connect to the bridge before writing',
        PermissionsExceptionCode.PERMISSION_DENIED,
      );
    }
  }
}
```

- [ ] **Step 5: Rodar → passa (5 casos)**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=agent-session-guard.service`
Expected: 5 passing.

- [ ] **Step 6: Criar os 6 hooks finos**

Cada arquivo é idêntico exceto pela operação no decorator e no nome da classe. Modelo — `.../connected-agent/query-hooks/agent-session-gate.create-one.pre-query-hook.ts`:

```ts
import { type ResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { AgentSessionGuardService } from 'src/engine/core-modules/connected-agent/services/agent-session-guard.service';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';

@WorkspaceQueryHook(`*.createOne`)
export class AgentSessionGateCreateOnePreQueryHook
  implements WorkspacePreQueryHookInstance
{
  constructor(
    private readonly agentSessionGuardService: AgentSessionGuardService,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: ResolverArgs,
  ): Promise<ResolverArgs> {
    await this.agentSessionGuardService.assertActiveSession(authContext);

    return payload;
  }
}
```

> A interface `WorkspacePreQueryHookInstance` exige exatamente `execute(authContext, objectName, payload: ResolverArgs): Promise<ResolverArgs>` (verificado no código). Como o gate não transforma o payload, todos os 6 hooks usam a mesma assinatura genérica `ResolverArgs` e devolvem o `payload` intacto — o mesmo shape serve para create/update/delete.

Criar os outros 5 arquivos idênticos, trocando **só** o decorator e o nome da classe:
- `agent-session-gate.create-many.pre-query-hook.ts` → `@WorkspaceQueryHook(`*.createMany`)`, classe `AgentSessionGateCreateManyPreQueryHook`.
- `agent-session-gate.update-one.pre-query-hook.ts` → `*.updateOne`, `AgentSessionGateUpdateOnePreQueryHook`.
- `agent-session-gate.update-many.pre-query-hook.ts` → `*.updateMany`, `AgentSessionGateUpdateManyPreQueryHook`.
- `agent-session-gate.delete-one.pre-query-hook.ts` → `*.deleteOne`, `AgentSessionGateDeleteOnePreQueryHook`.
- `agent-session-gate.delete-many.pre-query-hook.ts` → `*.deleteMany`, `AgentSessionGateDeleteManyPreQueryHook`.


- [ ] **Step 7: Criar o módulo do gate**

`.../connected-agent/agent-session-guard.module.ts`:

```ts
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
```

> Espelha o `ActorModule` (M1): providers + exports dos hooks. `ConnectedAgentModule` é importado para injetar `ConnectedAgentService` no gate service.

- [ ] **Step 8: Registrar o módulo no `core-engine.module.ts`**

Igual ao `ActorModule` (que já está lá): adicionar `AgentSessionGuardModule` ao array `imports` do `core-engine.module.ts`, com o import no topo:

```ts
import { AgentSessionGuardModule } from 'src/engine/core-modules/connected-agent/agent-session-guard.module';
```

- [ ] **Step 9: tsc + build (valida DI dos hooks)**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx tsc --noEmit -p tsconfig.json --skipLibCheck 2>&1 | grep -E "connected-agent|agent-session"`
Expected: sem erros dos seus arquivos.
Run: `cd ~/Projetos/twenty && npx nx run twenty-server:build`
Expected: build ok.

- [ ] **Step 10: Commit**

```bash
cd ~/Projetos/twenty
git add packages/twenty-server/src/engine/core-modules/connected-agent packages/twenty-server/src/engine/core-modules/core-engine.module.ts
git commit -m "feat(byoa): gate agent writes on an active bridge session via pre-query hooks"
```

---

## Task 4: Agent Bridge (controller + guard + service + DTOs + módulo)

**Files:**
- Create: `.../api/agent-bridge/dtos/agent-bridge-connect.dto.ts`
- Create: `.../api/agent-bridge/dtos/report-agent-event.input.ts`
- Create: `.../api/agent-bridge/guards/agent-bridge.guard.ts`
- Create: `.../api/agent-bridge/services/agent-bridge.service.ts`
- Create: `.../api/agent-bridge/controllers/agent-bridge.controller.ts`
- Create: `.../api/agent-bridge/agent-bridge.module.ts`
- Modify: `packages/twenty-server/@types/express.d.ts` (Step 0 — `connectedAgent?` no `Request`)
- Modify: `packages/twenty-server/src/app.module.ts` (registrar `AgentBridgeModule`, junto do `McpModule`)
- Test: `.../api/agent-bridge/services/__tests__/agent-bridge.service.spec.ts`

**Interfaces:**
- Consumes: `ConnectedAgentService` (`findActiveByApiKeyId`, `touchLastSeen`), `AgentActivityService` (`record`), `FlatApiKey`, `FlatWorkspace`, decorators `@AuthApiKey()`/`@AuthWorkspace()`, guards `JwtAuthGuard` + `WorkspaceAuthGuard`.
- Produces: rotas `POST /agent-bridge/connect`, `POST /agent-bridge/heartbeat`, `POST /agent-bridge/events`.

- [ ] **Step 0: Augmentar o tipo `Request` com `connectedAgent`**

O guard (Step 2) anexa `req.connectedAgent` e o controller (Step 7) lê. O `Request` do Express é augmentado em `packages/twenty-server/@types/express.d.ts` (`declare module 'express-serve-static-core' { interface Request {...} }`, onde `apiKey?`/`workspace?` já estão). Adicionar:

- No topo, junto aos imports existentes:
  ```ts
  import { type ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
  ```
- Dentro de `interface Request`, mais uma linha:
  ```ts
    connectedAgent?: ConnectedAgentEntity | null;
  ```

- [ ] **Step 1: DTOs**

`.../api/agent-bridge/dtos/agent-bridge-connect.dto.ts` (resposta REST, POJO simples — não é GraphQL):

```ts
export class AgentBridgeConnectResponse {
  connectedAgentId: string;
  name: string;
  status: string;
  sessionTtlMs: number;
  connectedAt: string;
}
```

`.../api/agent-bridge/dtos/report-agent-event.input.ts`:

```ts
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

import { AgentActivityType } from 'src/engine/core-modules/connected-agent/enums/agent-activity-type.enum';

export class ReportAgentEventInput {
  @IsEnum(AgentActivityType)
  type: AgentActivityType;

  @IsString()
  summary: string;

  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;
}
```

- [ ] **Step 2: Guard que exige agente ACTIVE**

`.../api/agent-bridge/guards/agent-bridge.guard.ts`. Roda DEPOIS de `JwtAuthGuard`/`WorkspaceAuthGuard` (que populam `req.apiKey`/`req.workspace`); resolve o `ConnectedAgent` e anexa em `req.connectedAgent`, senão 403.

```ts
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { getRequest } from 'src/utils/extract-request';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';

@Injectable()
export class AgentBridgeGuard implements CanActivate {
  constructor(
    private readonly connectedAgentService: ConnectedAgentService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequest(context);

    if (!isDefined(request?.apiKey) || !isDefined(request?.workspace)) {
      throw new ForbiddenException(
        'Agent bridge requires an API key authenticated request',
      );
    }

    const connectedAgent =
      await this.connectedAgentService.findActiveByApiKeyId(
        request.apiKey.id,
        request.workspace.id,
      );

    if (!isDefined(connectedAgent)) {
      throw new ForbiddenException(
        'This API key is not associated with an active connected agent',
      );
    }

    request.connectedAgent = connectedAgent;

    return true;
  }
}
```

> `getRequest(context)` retorna um request não-tipado (`any`), então `request.apiKey`/`request.workspace`/`request.connectedAgent` acessam sem erro em runtime; o Step 0 já augmentou o tipo `Request` com `connectedAgent` para o controller (Step 7), que usa `Request` tipado.

- [ ] **Step 3: Escrever o teste do service**

`.../api/agent-bridge/services/__tests__/agent-bridge.service.spec.ts`:

```ts
import { Test, type TestingModule } from '@nestjs/testing';

import { AgentBridgeService } from 'src/engine/api/agent-bridge/services/agent-bridge.service';
import { AgentActivityType } from 'src/engine/core-modules/connected-agent/enums/agent-activity-type.enum';
import { AgentActivityService } from 'src/engine/core-modules/connected-agent/services/agent-activity.service';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';

describe('AgentBridgeService', () => {
  let service: AgentBridgeService;
  let connectedAgentService: jest.Mocked<ConnectedAgentService>;
  let agentActivityService: jest.Mocked<AgentActivityService>;

  const agent = { id: 'agent-1', name: 'ProofBot', status: 'ACTIVE' } as never;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentBridgeService,
        { provide: ConnectedAgentService, useValue: { touchLastSeen: jest.fn() } },
        { provide: AgentActivityService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(AgentBridgeService);
    connectedAgentService = module.get(ConnectedAgentService);
    agentActivityService = module.get(AgentActivityService);
  });

  it('connect refreshes lastSeenAt and returns the agent identity + ttl', async () => {
    const result = await service.connect(agent, 'ws-1');

    expect(connectedAgentService.touchLastSeen).toHaveBeenCalledWith('agent-1', 'ws-1');
    expect(result.connectedAgentId).toBe('agent-1');
    expect(result.name).toBe('ProofBot');
    expect(result.sessionTtlMs).toBe(300_000);
  });

  it('heartbeat refreshes lastSeenAt', async () => {
    await service.heartbeat(agent, 'ws-1');
    expect(connectedAgentService.touchLastSeen).toHaveBeenCalledWith('agent-1', 'ws-1');
  });

  it('reportEvent refreshes lastSeenAt and records the activity', async () => {
    await service.reportEvent(agent, 'ws-1', {
      type: AgentActivityType.PROMPT,
      summary: 'hi',
      payload: { a: 1 },
    });

    expect(connectedAgentService.touchLastSeen).toHaveBeenCalledWith('agent-1', 'ws-1');
    expect(agentActivityService.record).toHaveBeenCalledWith({
      connectedAgentId: 'agent-1',
      workspaceId: 'ws-1',
      type: AgentActivityType.PROMPT,
      summary: 'hi',
      payload: { a: 1 },
    });
  });
});
```

- [ ] **Step 4: Rodar → falha**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=agent-bridge.service`
Expected: FAIL (cannot resolve `agent-bridge.service`).

- [ ] **Step 5: Implementar o service**

`.../api/agent-bridge/services/agent-bridge.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

import { type AgentBridgeConnectResponse } from 'src/engine/api/agent-bridge/dtos/agent-bridge-connect.dto';
import { type ReportAgentEventInput } from 'src/engine/api/agent-bridge/dtos/report-agent-event.input';
import { AGENT_SESSION_TTL_MS } from 'src/engine/core-modules/connected-agent/constants/agent-session.const';
import { type ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { AgentActivityService } from 'src/engine/core-modules/connected-agent/services/agent-activity.service';
import { ConnectedAgentService } from 'src/engine/core-modules/connected-agent/services/connected-agent.service';

@Injectable()
export class AgentBridgeService {
  constructor(
    private readonly connectedAgentService: ConnectedAgentService,
    private readonly agentActivityService: AgentActivityService,
  ) {}

  async connect(
    agent: ConnectedAgentEntity,
    workspaceId: string,
  ): Promise<AgentBridgeConnectResponse> {
    await this.connectedAgentService.touchLastSeen(agent.id, workspaceId);

    return {
      connectedAgentId: agent.id,
      name: agent.name,
      status: agent.status,
      sessionTtlMs: AGENT_SESSION_TTL_MS,
      connectedAt: new Date().toISOString(),
    };
  }

  async heartbeat(
    agent: ConnectedAgentEntity,
    workspaceId: string,
  ): Promise<void> {
    await this.connectedAgentService.touchLastSeen(agent.id, workspaceId);
  }

  async reportEvent(
    agent: ConnectedAgentEntity,
    workspaceId: string,
    input: ReportAgentEventInput,
  ): Promise<void> {
    await this.connectedAgentService.touchLastSeen(agent.id, workspaceId);
    await this.agentActivityService.record({
      connectedAgentId: agent.id,
      workspaceId,
      type: input.type,
      summary: input.summary,
      payload: input.payload ?? null,
    });
  }
}
```

> Nota sobre `connectedAt` e `new Date()`: em produção é fine; nos testes NÃO asserte o valor de `connectedAt` (o teste do Step 3 não o faz).

- [ ] **Step 6: Rodar → passa (3 casos)**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=agent-bridge.service`
Expected: 3 passing.

- [ ] **Step 7: Controller**

`.../api/agent-bridge/controllers/agent-bridge.controller.ts`. Padrão do MCP (guards + decorators); o `AgentBridgeGuard` roda por último e anexa `req.connectedAgent`. Extrair o agente com um decorator param simples via `@Req()`.

```ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';

import { type Request } from 'express';

import { AgentBridgeConnectResponse } from 'src/engine/api/agent-bridge/dtos/agent-bridge-connect.dto';
import { ReportAgentEventInput } from 'src/engine/api/agent-bridge/dtos/report-agent-event.input';
import { AgentBridgeGuard } from 'src/engine/api/agent-bridge/guards/agent-bridge.guard';
import { AgentBridgeService } from 'src/engine/api/agent-bridge/services/agent-bridge.service';
import { type ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { FlatWorkspace } from 'src/engine/core-modules/workspace/types/flat-workspace.type';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@Controller('agent-bridge')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard, AgentBridgeGuard)
export class AgentBridgeController {
  constructor(private readonly agentBridgeService: AgentBridgeService) {}

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  async connect(
    @Req() req: Request,
    @AuthWorkspace() workspace: FlatWorkspace,
  ): Promise<AgentBridgeConnectResponse> {
    const agent = req.connectedAgent as ConnectedAgentEntity;

    return this.agentBridgeService.connect(agent, workspace.id);
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.NO_CONTENT)
  async heartbeat(
    @Req() req: Request,
    @AuthWorkspace() workspace: FlatWorkspace,
  ): Promise<void> {
    await this.agentBridgeService.heartbeat(
      req.connectedAgent as ConnectedAgentEntity,
      workspace.id,
    );
  }

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async reportEvent(
    @Req() req: Request,
    @AuthWorkspace() workspace: FlatWorkspace,
    @Body() input: ReportAgentEventInput,
  ): Promise<void> {
    await this.agentBridgeService.reportEvent(
      req.connectedAgent as ConnectedAgentEntity,
      workspace.id,
      input,
    );
  }
}
```

> `req.connectedAgent` foi anexado pelo `AgentBridgeGuard` e já foi tipado no `@types/express.d.ts` no Step 0. O cast `as ConnectedAgentEntity` remove o `| null | undefined` do tipo augmentado (o guard garante que está presente — sem agente ele já lançou 403).

- [ ] **Step 8: Módulo do bridge**

`.../api/agent-bridge/agent-bridge.module.ts`. Espelha o `McpModule` para os guards (importa `TokenModule` e o que o `JwtAuthGuard` precisa) + `ConnectedAgentModule` para os services.

```ts
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
```

> `JwtAuthGuard` depende de `AccessTokenService` (de `TokenModule`) e `WorkspaceCacheStorageService` (de `WorkspaceCacheStorageModule`) — por isso ambos são importados (confirmar contra o `McpModule`, que faz o mesmo). Se o boot acusar dependência faltando (ex.: um provider do `JwtAuthGuard` não exportado), espelhar exatamente os `imports` do `McpModule`.

- [ ] **Step 9: Registrar o `AgentBridgeModule` no `app.module.ts`**

Os módulos de API (como `McpModule`) são registrados em `packages/twenty-server/src/app.module.ts` (o `McpModule` está lá, ~linha 71). Adicionar `AgentBridgeModule` ao array `imports` do `app.module.ts`, logo após `McpModule`, com o import no topo:

```ts
import { AgentBridgeModule } from 'src/engine/api/agent-bridge/agent-bridge.module';
```

- [ ] **Step 10: tsc + build**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx tsc --noEmit -p tsconfig.json --skipLibCheck 2>&1 | grep -E "agent-bridge"`
Expected: sem erros dos seus arquivos.
Run: `cd ~/Projetos/twenty && npx nx run twenty-server:build`
Expected: build ok.

- [ ] **Step 11: Commit**

```bash
cd ~/Projetos/twenty
git add packages/twenty-server/src/engine/api/agent-bridge packages/twenty-server/src/engine/core-modules/core-engine.module.ts
git commit -m "feat(byoa): add agent-bridge connect/heartbeat/events endpoints"
```

---

## Task 5: Verificação end-to-end

**Files:** nenhum de produção. Verificação manual contra o servidor rodando. (Executada pelo controller, NÃO por subagente, para não deixar o `yarn start` órfão.)

**Interfaces:** consome os endpoints do bridge (Task 4) + o gate (Task 3) + a proveniência do M1.

- [ ] **Step 1: Subir o servidor e confirmar boot limpo**

Run (background): `cd ~/Projetos/twenty && yarn start`
Aguardar `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/healthz` == 200. Conferir no log: sem `UnknownDependenciesException` (valida a DI de `AgentBridgeModule` + `AgentSessionGuardModule`).

- [ ] **Step 2: Provisionar um agente (como no M1)**

- Gerar uma API key Admin: `WSID=$(psql -d default -tAc "select id from core.workspace limit 1;")` ; `npx nx run twenty-server:command -- workspace:generate-api-key --workspace-id "$WSID" --name "M2Bot"` → capturar `TOKEN:`.
- Decodificar o `jti` do JWT (= apiKeyId) e `INSERT INTO core."connectedAgent"("workspaceId",name,"apiKeyId",status) VALUES ('$WSID','M2Bot','<apiKeyId>','ACTIVE');`. **Não** setar `lastSeenAt` (fica null → sessão inativa de largada).

- [ ] **Step 3: Escrita ANTES de conectar → deve ser BLOQUEADA**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/rest/companies \
  -H 'Content-Type: application/json' -H "Authorization: Bearer <TOKEN>" -d '{"name":"Blocked Co"}'
```
Expected: **não** 200/201 (403 / erro de permissão). Confirmar que a company NÃO foi criada: `psql -d default -tAc "select count(*) from workspace_<...>.company where name='Blocked Co';"` → 0.

- [ ] **Step 4: `connect` → depois escrita → deve PASSAR**

```bash
curl -s -X POST http://localhost:3000/agent-bridge/connect -H "Authorization: Bearer <TOKEN>"
```
Expected: JSON com `connectedAgentId`, `name: "M2Bot"`, `sessionTtlMs: 300000`.
Então repetir o POST de company → Expected: 201; e `createdBy = AGENT / M2Bot` (proveniência do M1 segue funcionando).

- [ ] **Step 5: `events` grava atividade**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/agent-bridge/events \
  -H 'Content-Type: application/json' -H "Authorization: Bearer <TOKEN>" \
  -d '{"type":"PROMPT","summary":"user asked to create a company","payload":{"x":1}}'
```
Expected: 202. Conferir: `psql -d default -tAc "select type, summary from core.\"agentActivity\";"` → `PROMPT|user asked to create a company`.

- [ ] **Step 6: Sessão expirada → escrita volta a BLOQUEAR**

Simular expiração envelhecendo `lastSeenAt`: `psql -d default -c "UPDATE core.\"connectedAgent\" SET \"lastSeenAt\" = now() - interval '10 minutes' WHERE name='M2Bot';"`
Então POST de company → Expected: bloqueado (403). Depois `POST /agent-bridge/heartbeat` → repetir POST → Expected: 201 de novo.

- [ ] **Step 7: Não-regressão — API key comum (sem agente) escreve normal**

Gerar 2ª key sem `connectedAgent`, POST de company → Expected: 201, `createdBy = API` (não gateado). E um usuário logado na UI também escreve normal.

- [ ] **Step 8: Limpeza + matar servidor**

Deletar as companies de teste, o `connectedAgent` M2Bot, o `agentActivity`, e revogar/apagar as API keys Admin de teste. Matar a árvore do `yarn start` (concurrently/nest/vite/worker) e confirmar portas 3000/3001 livres. Postgres/Redis seguem de pé.

- [ ] **Step 9: Registrar a verificação no spec e commitar**

Anexar os resultados reais a uma seção `## Verificação M2` no spec e commitar (`docs(byoa): record M2 end-to-end verification`).

---

## Critério de pronto do M2

Um agente só escreve no CRM **depois** de `connect` e enquanto mantém heartbeat; escritas sem sessão ativa são bloqueadas com erro de permissão; `heartbeat` renova; `events` registra atividade em `core.agentActivity`; usuários e API keys comuns não são afetados; a proveniência AGENT do M1 continua funcionando nas escritas permitidas.

## Notas para M3 (não implementar)

- A UI (Settings → Agents) lê `ConnectedAgent` (lista + presença via `lastSeenAt`) e `AgentActivity` (feed), combinando com a proveniência real dos registros.
- `AgentActivityService.listForAgent` já existe para o feed.
- `destroyOne/destroyMany/restoreMany/mergeMany` NÃO são gateados na v1 (só create/update/delete). Se necessário, adicionar hooks análogos.
