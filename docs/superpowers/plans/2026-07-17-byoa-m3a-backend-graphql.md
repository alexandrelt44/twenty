# BYOA M3a — Backend GraphQL (queries + management mutations para a UI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Expor via GraphQL (schema **metadata**) o que a UI "Connected Agents" (M3b) precisa: listar agentes, ler um agente, ler o feed de atividade, e gerenciar (ativar/desativar, excluir). Sem UI ainda.

**Architecture:** Estende o `ConnectedAgentResolver` existente (já `@MetadataResolver(() => ConnectedAgentEntity)`, gated por `API_KEYS_AND_WEBHOOKS`) com `@Query`/`@Mutation`/`@ResolveField`, mirando o padrão do `ApiKeyResolver`. Adiciona métodos de leitura/gestão ao `ConnectedAgentService` (M1). Corrige o `payload` do `AgentActivity` (pendência do M2) para um scalar JSON. A role do agente vem do `apiKeyId` via `ApiKeyRoleService.getRoleDtoByApiKeyId` (reuso).

**Tech Stack:** NestJS, TypeORM, GraphQL (`@nestjs/graphql`, `graphql-type-json`), Jest (`@swc/jest`). Sobre o M1/M2 (branch `dev`).

## Global Constraints
- Repo `~/Projetos/twenty`, branch `dev`. Commitar nesta branch. M1+M2 já mergeados.
- Reuso `PermissionFlagType.API_KEYS_AND_WEBHOOKS` (o resolver já é gated por ela). NÃO criar `PermissionFlagType` novo.
- Resolver usa `@MetadataResolver(() => Entity)` (NÃO `@Resolver`) — vai pro schema `/metadata`. DTOs de input com `@InputType()`.
- `ConnectedAgentModule` continua **mínimo** (M1): exporta só services, importa só TypeOrm — NÃO ganha feature module. Os novos métodos usam o repositório já injetado.
- Testes: `cd packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=<x>`. NUNCA `npx nx test`.
- tsc: `cd packages/twenty-server && npx tsc --noEmit -p tsconfig.json --skipLibCheck 2>&1 | grep -E "connected-agent|agent-activity"` (ignorar erros pré-existentes `@file-type/pdf`, `is-psl-parsed-domain`).
- Build/DI/schema só validam no BOOT — Task 4 sobe o servidor.
- Imports alias `src/...`. Espelhar `ApiKeyResolver` (`api-key.resolver.ts`) e `GetApiKeyInput` (`dtos/get-api-key.input.ts`).

## File Structure
**Modificar:**
- `.../connected-agent/services/connected-agent.service.ts` — add `findByWorkspaceId`, `findById`, `setStatus`, `softDelete`.
- `.../connected-agent/agent-activity.entity.ts` — `payload` vira `@Field(() => GraphQLJSON, { nullable: true })`.
- `.../connected-agent/connected-agent.resolver.ts` — add queries, resolve-field role, mutations.
- `.../connected-agent/connected-agent-provisioning.module.ts` — importar `ConnectedAgentModule`.
**Criar:**
- `.../connected-agent/dtos/get-connected-agent.input.ts` — `{ id }`.
- `.../connected-agent/dtos/get-connected-agent-activity.input.ts` — `{ connectedAgentId }`.
- `.../connected-agent/dtos/set-connected-agent-status.input.ts` — `{ id, status }`.
- `.../connected-agent/dtos/delete-connected-agent.input.ts` — `{ id }`.
**Testes:** ao lado dos services/resolver.

---

## Task 1: Métodos de leitura/gestão no `ConnectedAgentService`

**Files:**
- Modify: `.../connected-agent/services/connected-agent.service.ts`
- Test: adicionar ao `.../services/__tests__/connected-agent.service.spec.ts` (existe)

**Interfaces:**
- Consumes: `ConnectedAgentEntity`, `ConnectedAgentStatus`, `Repository`.
- Produces:
  - `findByWorkspaceId(workspaceId): Promise<ConnectedAgentEntity[]>` (não deletados, ordenado por `createdAt` DESC)
  - `findById(id, workspaceId): Promise<ConnectedAgentEntity | null>`
  - `setStatus(id, workspaceId, status: ConnectedAgentStatus): Promise<ConnectedAgentEntity | null>`
  - `softDelete(id, workspaceId): Promise<void>`

- [ ] **Step 1: Testes (adicionar ao spec existente, sem tocar nos que já existem)**

Adicionar ao mock do repositório (`getRepositoryToken(ConnectedAgentEntity)` provider) os métodos usados: garantir `find`, `findOne` (já existe), `update`, `softDelete`. Adicionar os `describe`:

```ts
  describe('findByWorkspaceId', () => {
    it('lists non-deleted agents for the workspace, newest first', async () => {
      const rows = [{ id: 'a1' }] as ConnectedAgentEntity[];
      (repository.find as jest.Mock).mockResolvedValue(rows);

      const result = await service.findByWorkspaceId('ws-1');

      expect(repository.find).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toBe(rows);
    });
  });

  describe('findById', () => {
    it('finds one agent scoped by workspace', async () => {
      const agent = { id: 'a1' } as ConnectedAgentEntity;
      (repository.findOne as jest.Mock).mockResolvedValue(agent);

      const result = await service.findById('a1', 'ws-1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'a1', workspaceId: 'ws-1' },
      });
      expect(result).toBe(agent);
    });
  });

  describe('setStatus', () => {
    it('updates status scoped by id+workspace and returns the reloaded agent', async () => {
      const updated = { id: 'a1', status: ConnectedAgentStatus.DISABLED } as ConnectedAgentEntity;
      (repository.update as jest.Mock).mockResolvedValue(undefined);
      (repository.findOne as jest.Mock).mockResolvedValue(updated);

      const result = await service.setStatus('a1', 'ws-1', ConnectedAgentStatus.DISABLED);

      expect(repository.update).toHaveBeenCalledWith(
        { id: 'a1', workspaceId: 'ws-1' },
        { status: ConnectedAgentStatus.DISABLED },
      );
      expect(result).toBe(updated);
    });
  });

  describe('softDelete', () => {
    it('soft-deletes the agent scoped by id+workspace', async () => {
      const softDelete = repository.softDelete as jest.Mock;

      await service.softDelete('a1', 'ws-1');

      expect(softDelete).toHaveBeenCalledWith({ id: 'a1', workspaceId: 'ws-1' });
    });
  });
```

- [ ] **Step 2: Rodar → falha**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=connected-agent.service`
Expected: FAIL (métodos não existem).

- [ ] **Step 3: Implementar os métodos**

Adicionar à classe `ConnectedAgentService` (importar `IsNull` já pode estar; adicionar `ConnectedAgentStatus` se necessário):

```ts
  async findByWorkspaceId(
    workspaceId: string,
  ): Promise<ConnectedAgentEntity[]> {
    return this.connectedAgentRepository.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<ConnectedAgentEntity | null> {
    return this.connectedAgentRepository.findOne({
      where: { id, workspaceId },
    });
  }

  async setStatus(
    id: string,
    workspaceId: string,
    status: ConnectedAgentStatus,
  ): Promise<ConnectedAgentEntity | null> {
    await this.connectedAgentRepository.update({ id, workspaceId }, { status });

    return this.findById(id, workspaceId);
  }

  async softDelete(id: string, workspaceId: string): Promise<void> {
    await this.connectedAgentRepository.softDelete({ id, workspaceId });
  }
```

> `find`/`findOne` já excluem soft-deleted por padrão (entidade tem `@DeleteDateColumn`). `setStatus`/`softDelete` são escopados por `workspaceId` (anti cross-tenant).

- [ ] **Step 4: Rodar → passa**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx jest --config jest.config.mjs --coverage=false --testPathPatterns=connected-agent.service`
Expected: todos passam (M1/M2 + os 4 novos describe).

- [ ] **Step 5: tsc + commit**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx tsc --noEmit -p tsconfig.json --skipLibCheck 2>&1 | grep connected-agent` → sem erros seus.
```bash
cd ~/Projetos/twenty
git add packages/twenty-server/src/engine/core-modules/connected-agent/services/connected-agent.service.ts packages/twenty-server/src/engine/core-modules/connected-agent/services/__tests__/connected-agent.service.spec.ts
git commit -m "feat(byoa): add connected-agent read/manage service methods"
```

---

## Task 2: `payload` do AgentActivity como scalar JSON

**Files:**
- Modify: `.../connected-agent/agent-activity.entity.ts`

**Interfaces:** nenhuma nova; só corrige o tipo GraphQL do campo `payload` (era `@Field(() => String)` sobre um `Record<string,unknown>` jsonb — dormência do M2 que quebraria ao expor via GraphQL).

- [ ] **Step 1: Trocar o tipo do Field**

No topo do arquivo, adicionar o import (mirror `admin-panel/dtos/config-variable.dto.ts:3`):

```ts
import GraphQLJSON from 'graphql-type-json';
```

Trocar a linha do campo `payload`:

```ts
  @Field(() => String, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;
```

por:

```ts
  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;
```

- [ ] **Step 2: tsc**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx tsc --noEmit -p tsconfig.json --skipLibCheck 2>&1 | grep agent-activity`
Expected: sem erros. (A validação real de que o schema aceita o scalar é no boot da Task 4.)

- [ ] **Step 3: Commit**

```bash
cd ~/Projetos/twenty
git add packages/twenty-server/src/engine/core-modules/connected-agent/agent-activity.entity.ts
git commit -m "fix(byoa): expose AgentActivity.payload as a JSON scalar"
```

---

## Task 3: Queries + resolve-field role + mutations no resolver

**Files:**
- Create: `.../connected-agent/dtos/get-connected-agent.input.ts`
- Create: `.../connected-agent/dtos/get-connected-agent-activity.input.ts`
- Create: `.../connected-agent/dtos/set-connected-agent-status.input.ts`
- Create: `.../connected-agent/dtos/delete-connected-agent.input.ts`
- Modify: `.../connected-agent/connected-agent.resolver.ts`
- Modify: `.../connected-agent/connected-agent-provisioning.module.ts`

**Interfaces:**
- Consumes: `ConnectedAgentService` (Task 1), `AgentActivityService` (`listForAgent`, M2), `ApiKeyRoleService.getRoleDtoByApiKeyId` (existe), `RoleDTO`, `ConnectedAgentEntity`, `AgentActivityEntity`, `ConnectedAgentStatus`.
- Produces (GraphQL, schema metadata): `connectedAgents: [ConnectedAgent!]!`, `connectedAgent(input): ConnectedAgent`, `connectedAgentActivity(input): [AgentActivity!]!`, resolve-field `ConnectedAgent.role: Role`, `setConnectedAgentStatus(input): ConnectedAgent`, `deleteConnectedAgent(input): Boolean`.

- [ ] **Step 1: DTOs (mirror `GetApiKeyInput`)**

`get-connected-agent.input.ts`:

```ts
import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsUUID } from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@InputType()
export class GetConnectedAgentInput {
  @Field(() => UUIDScalarType)
  @IsNotEmpty()
  @IsUUID()
  id: string;
}
```

`get-connected-agent-activity.input.ts` (mesma forma, campo `connectedAgentId`):

```ts
import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsUUID } from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@InputType()
export class GetConnectedAgentActivityInput {
  @Field(() => UUIDScalarType)
  @IsNotEmpty()
  @IsUUID()
  connectedAgentId: string;
}
```

`delete-connected-agent.input.ts` (igual ao get, classe `DeleteConnectedAgentInput`, campo `id`).

`set-connected-agent-status.input.ts`:

```ts
import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { ConnectedAgentStatus } from 'src/engine/core-modules/connected-agent/enums/connected-agent-status.enum';

@InputType()
export class SetConnectedAgentStatusInput {
  @Field(() => UUIDScalarType)
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @Field(() => ConnectedAgentStatus)
  @IsEnum(ConnectedAgentStatus)
  status: ConnectedAgentStatus;
}
```

- [ ] **Step 2: Importar `ConnectedAgentModule` no provisioning module**

Em `connected-agent-provisioning.module.ts`, adicionar ao `imports` (junto de `ApiKeyModule`) e ao import no topo:

```ts
import { ConnectedAgentModule } from 'src/engine/core-modules/connected-agent/connected-agent.module';
```

`ConnectedAgentModule` exporta `ConnectedAgentService` + `AgentActivityService`. `ApiKeyModule` (já importado) exporta `ApiKeyRoleService`.

- [ ] **Step 3: Estender o resolver**

Em `connected-agent.resolver.ts`: adicionar imports (`Query, ResolveField, Parent` de `@nestjs/graphql`; os 4 DTOs; `ConnectedAgentEntity`, `AgentActivityEntity`, `ConnectedAgentService`, `AgentActivityService`, `ApiKeyRoleService`, `RoleDTO`, `WorkspaceEntity`, `AuthWorkspace`), injetar os 3 services no constructor (mantendo o `connectedAgentProvisioningService`), e adicionar:

```ts
  @Query(() => [ConnectedAgentEntity])
  async connectedAgents(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<ConnectedAgentEntity[]> {
    return this.connectedAgentService.findByWorkspaceId(workspace.id);
  }

  @Query(() => ConnectedAgentEntity, { nullable: true })
  async connectedAgent(
    @Args('input') input: GetConnectedAgentInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<ConnectedAgentEntity | null> {
    return this.connectedAgentService.findById(input.id, workspace.id);
  }

  @Query(() => [AgentActivityEntity])
  async connectedAgentActivity(
    @Args('input') input: GetConnectedAgentActivityInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<AgentActivityEntity[]> {
    return this.agentActivityService.listForAgent(
      input.connectedAgentId,
      workspace.id,
    );
  }

  @ResolveField(() => RoleDTO, { nullable: true })
  async role(
    @Parent() connectedAgent: ConnectedAgentEntity,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<RoleDTO | null> {
    // getRoleDtoByApiKeyId THROWS (API_KEY_NO_ROLE_ASSIGNED) when the key has
    // no role. Provisioned agents always have one, but tolerate a role-less
    // agent gracefully so the list query never breaks on a single bad row.
    try {
      return await this.apiKeyRoleService.getRoleDtoByApiKeyId({
        apiKeyId: connectedAgent.apiKeyId,
        workspaceId: workspace.id,
      });
    } catch {
      return null;
    }
  }

  @Mutation(() => ConnectedAgentEntity, { nullable: true })
  async setConnectedAgentStatus(
    @Args('input') input: SetConnectedAgentStatusInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<ConnectedAgentEntity | null> {
    return this.connectedAgentService.setStatus(
      input.id,
      workspace.id,
      input.status,
    );
  }

  @Mutation(() => Boolean)
  async deleteConnectedAgent(
    @Args('input') input: DeleteConnectedAgentInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<boolean> {
    await this.connectedAgentService.softDelete(input.id, workspace.id);

    return true;
  }
```

> Assinatura confirmada: `getRoleDtoByApiKeyId({ apiKeyId, workspaceId }): Promise<RoleDTO>` (`api-key-role.service.ts:85`).
> O resolver inteiro já é gated por `@UseGuards(WorkspaceAuthGuard, SettingsPermissionGuard(API_KEYS_AND_WEBHOOKS))` — todas as novas queries/mutations herdam isso.

- [ ] **Step 4: tsc**

Run: `cd ~/Projetos/twenty/packages/twenty-server && npx tsc --noEmit -p tsconfig.json --skipLibCheck 2>&1 | grep -E "connected-agent"`
Expected: sem erros seus. (Se `getRoleDtoByApiKeyId` reclamar de args, corrigir conforme a assinatura real.)

- [ ] **Step 5: Commit**

```bash
cd ~/Projetos/twenty
git add packages/twenty-server/src/engine/core-modules/connected-agent
git commit -m "feat(byoa): expose connected-agent queries, role field, and manage mutations"
```

---

## Task 4: Verificação (boot + schema)

**Files:** nenhum de produção. Executado pelo controller (não subagente — evita servidor órfão).

- [ ] **Step 1: Boot limpo**

`cd ~/Projetos/twenty && yarn start` (background). Aguardar healthz 200. Conferir no log: sem `UnknownDependenciesException` (valida a DI do `ConnectedAgentModule` no provisioning module) e sem erro de build de schema (valida que `GraphQLJSON`, os novos `@Query`/`@Mutation`/`@ResolveField` e os `@InputType` entram no schema metadata sem conflito).

- [ ] **Step 2: Schema metadata expõe os campos novos**

Introspection do endpoint metadata confirmando os tipos. Com um token de usuário (copiar o `Authorization: Bearer` de um request GraphQL no DevTools após login em `localhost:3001`), rodar:

```bash
curl -s http://localhost:3000/metadata -H 'Content-Type: application/json' -H "Authorization: Bearer <USER_TOKEN>" \
  -d '{"query":"{ __type(name:\"ConnectedAgent\"){ fields { name } } }"}'
```
Expected: inclui `role`, `status`, `lastSeenAt`, `name`. E `__type(name:"Query")` inclui `connectedAgents`, `connectedAgent`, `connectedAgentActivity`; `__type(name:"Mutation")` inclui `setConnectedAgentStatus`, `deleteConnectedAgent`.

> Se não for viável obter o token de usuário facilmente, o critério mínimo é: boot limpo + o schema builder não rejeita nenhum tipo (um `@Field`/`@Query` inválido derruba o boot). O exercício completo via GraphQL acontece no M3b (a UI dirige as queries com a sessão do usuário logado).

- [ ] **Step 3: Matar o servidor + registrar**

Matar a árvore do `yarn start` (portas 3000/3001 livres). Anexar resultado a `## Verificação M3a` no spec e commitar.

---

## Critério de pronto do M3a
O schema metadata expõe `connectedAgents`/`connectedAgent`/`connectedAgentActivity` (+ `ConnectedAgent.role`) e `setConnectedAgentStatus`/`deleteConnectedAgent`, todos gated por `API_KEYS_AND_WEBHOOKS`, com o servidor bootando limpo. Base pronta pro M3b (a UI).

## Notas para M3b (frontend, próximo plano)
- Seção de topo própria "Connected Agents" no nav de Settings (não sob Developers, não sob AI — decisão do usuário).
- Mirror das páginas de API Keys: `SettingsApiWebhooks.tsx` (lista), `SettingsDevelopersApiKeysNew.tsx` (criar+token), `SettingsDevelopersApiKeyDetail.tsx` (detalhe+danger zone). Componentes: `Table/TableRow/TableCell`, `Status` (twenty-ui/display) pra ACTIVE/DISABLED + presença, `ConfirmationModal`+`useModal`, `beautifyPastDateRelativeToNowShort` pra "visto por último".
- `createConnectedAgent` (M1) já retorna o token → fluxo de token-uma-vez mais simples que o de api-keys.
- Documentos gql em `modules/settings/**/graphql/`; regenerar com `npx nx run twenty-front:graphql:generate --configuration=metadata` (precisa do backend no ar). Tipos em `~/generated-metadata/graphql`.
- 4 pontos de permissão (rota `SettingsProtectedRouteWrapper`, nav `isHidden`, hook `useHasPermissionFlag`, guard backend) com `API_KEYS_AND_WEBHOOKS`.

---
## Verificação M3a (2026-07-17) — via boot + introspection do schema metadata
Servidor sobe limpo (healthz 200, 0 UnknownDependenciesException/schema error). Introspection confirmou:
- Query: `connectedAgents`, `connectedAgent`, `connectedAgentActivity` presentes.
- Mutation: `setConnectedAgentStatus`, `deleteConnectedAgent` (+ `createConnectedAgent` do M1).
- Type `ConnectedAgent`: campos id/name/description/status/lastSeenAt/createdAt/updatedAt/**role** (resolve-field).
- `AgentActivity.payload` tipo **JSON** (fix do scalar OK).
