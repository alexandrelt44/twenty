# BYOA — Bring Your Own Agent (estilo ProofEditor) no Twenty

**Data:** 2026-07-16
**Fork:** `alexandrelt44/twenty`, branch `dev` @ tag `v2.2.0`
**Status:** design aprovado — implementar **M1** primeiro

---

## 1. Objetivo

Permitir que **agentes externos, controlados pelo próprio operador**, conectem-se ao Twenty via
**token**, executem **mudanças efetivas** no CRM (criar/editar registros) e tenham suas ações
**atribuídas a eles** na UI — no espírito do ProofEditor / `proof-sdk` (agent-bridge HTTP +
provenance), porém adaptado ao modelo de dados estruturado do Twenty.

**Explicitamente fora de escopo (v2):** camada de *suggestion/approval* (agente propõe, humano
revisa antes de aplicar). Nesta v1 as mudanças do agente são **efetivas**.

### Decisões travadas
- **Transporte:** REST/HTTP (estilo agent-bridge do Proof). **Sem MCP.**
- **Token:** **API key** amarrada a uma **Role** dedicada (não OAuth).
- **Agentes:** próprios do operador, **confiáveis** (modelo de segurança simples).
- **Proveniência:** carimbar `source: AGENT` com identidade própria do agente.

---

## 2. Contexto: o que o Twenty v2.2.0 já oferece (não reinventar)

| Peça | Onde | Reuso |
|---|---|---|
| Auth por token | `engine/core-modules/api-key` (`createApiKey(input.roleId)`) + `auth-context.type.ts` (`apiKey?: FlatApiKey`) | Credencial do agente |
| Permissões por role | API key → `roleId`; `Application.defaultRole` | Escopo mínimo do agente |
| Enum de proveniência | `twenty-shared/.../actor.composite-type.ts` → `FieldActorSource` já tem `AGENT`, `API`, `APPLICATION` | `source: AGENT` |
| Carimbo de autoria | `engine/core-modules/actor`: `actor-from-auth-context.service.ts`, builders (`build-created-by-from-api-key.util.ts` = `{source: API, name: apiKey.name}`), e **pre-query hooks** `created-by.create-one/many` e `updated-by.update-one/many` | Autoria em create **e** update, automática |
| REST API de registros | `engine/api` (REST) | Mudanças efetivas do agente |
| UI de Settings | front: `pages/settings/developers/api-keys`, `pages/settings/applications`, `modules/settings/applications` | Base da tela de agentes |

**Conclusão:** o transporte via token e a proveniência de create/update **já são nativos**. O
trabalho é (a) dar ao token uma **identidade de agente** que carimbe `source: AGENT`, (b) um
**endpoint de conexão** dedicado com presença/atividade, e (c) a **UI** que mostra os agentes e o
que fazem.

---

## 3. Arquitetura

Três unidades com responsabilidade única e interface clara:

```
Agente externo (seu)                Twenty (fork)
────────────────────                ─────────────────────────────────────
  HTTP + Bearer <api-key>  ──────▶   [M2] Agent Bridge  (connect / heartbeat / events)
                           ──────▶   REST API de registros (create/update efetivos)
                                        │
                                        ▼
                                     [M1] Actor provenance  (source: AGENT + nome)
                                        │  (pre-query hooks já existentes)
                                        ▼
                                     core.<objeto>.createdBy / updatedBy
                                        │
                                        ▼
                                     [M3] Settings → Agents  (lista, presença, feed de atividade)
```

### 3.1 Modelo de dados novo — `ConnectedAgent`

Uma entidade **nova e leve** em `schema: core`, separada do `AgentEntity` interno
(`metadata-modules/ai/ai-agent`, que é o agente de IA que o *próprio Twenty* roda). O
`ConnectedAgent` representa um agente **externo** que se conecta.

```
core.connectedAgent
  id            uuid  pk
  workspaceId   uuid  (WorkspaceRelatedEntity)
  name          text            # vira o autor em createdBy/updatedBy
  description   text  null
  apiKeyId      uuid  → core.apiKey        # credencial (token) — a role vem DAQUI
  status        enum(ACTIVE, DISABLED)
  lastSeenAt    timestamptz null           # presença (heartbeat)
  createdAt / updatedAt / deletedAt
```

- 1 `ConnectedAgent` ↔ 1 API key (a key é o token; o agente é a identidade exibível).
- **Permissões:** fonte única = `apiKey.roleId`. O `ConnectedAgent` não duplica a role; a UI a
  lê através da API key (least privilege).

### 3.2 Registro de atividade — `AgentActivity`

Feed estilo "marks/events" do Proof — o que o agente reportou/fez.

```
core.agentActivity
  id            uuid pk
  workspaceId   uuid
  connectedAgentId uuid → core.connectedAgent
  type          enum(PROMPT, ACTION, NOTE)   # prompt recebido, ação executada, etc.
  summary       text                          # texto curto para a UI
  payload       jsonb null                     # detalhe (ex.: qual registro, qual campo)
  createdAt     timestamptz
```

O feed da UI (M3) combina `AgentActivity` (auto-reportado pelo agente via M2) com a proveniência
real dos registros (`createdBy/updatedBy` + audit log já existente).

---

## 4. Milestones

### M1 · Backend de identidade + proveniência  *(implementar primeiro; entrega valor sozinho)*

**Meta:** um agente com um token consegue operar o CRM via REST e suas escritas aparecem
atribuídas a ele como **AGENT**.

1. Entidade `ConnectedAgent` (+ migration) e serviço CRUD.
2. Provisionamento: criar `ConnectedAgent` → cria Role dedicada (se não informada) + API key
   (`createApiKey({ roleId })`), devolve o **token uma única vez**.
3. Proveniência `source: AGENT`:
   - Novo util `build-created-by-from-agent.util.ts` → `{ source: AGENT, name: agent.name, context: { connectedAgentId } }`.
   - Em `actor-from-auth-context.service.ts`: se a `apiKey` do `AuthContext` pertence a um
     `ConnectedAgent`, usar o builder de agente em vez do de API key.
   - **Sem tocar** nos pre-query hooks: `created-by.*` e `updated-by.*` já chamam esse serviço,
     então create **e** update passam a carimbar `AGENT` automaticamente.
4. Verificação: token de teste → `POST /rest/companies` e `PATCH` → conferir `createdBy/updatedBy`
   = `{source: AGENT, name}` no banco e na UI.

**Critério de pronto:** registro criado/editado por um agente mostra o nome do agente como autor,
com `source = AGENT`.

### M2 · Agent Bridge (endpoint de conexão, estilo Proof)

**Meta:** um canal de conexão dedicado com handshake, presença e feed de eventos.

Módulo HTTP novo (`engine/api/agent-bridge`), autenticado por API key (Bearer), guard reaproveitando
a auth existente. Rotas canônicas (espelhando o agent-bridge do Proof, mapeadas ao Twenty):

| Rota | Método | Função |
|---|---|---|
| `/agent-bridge/connect` | POST | Handshake: valida token, resolve `ConnectedAgent`, marca `lastSeenAt`, devolve identidade + capacidades (role/escopos) |
| `/agent-bridge/heartbeat` | POST | Atualiza `lastSeenAt` (presença) |
| `/agent-bridge/events` | POST | Agente reporta atividade (`AgentActivity`: prompt/ação) |
| `/agent-bridge/state` | GET | (opcional) Contexto/escopo que o agente pode operar |

Mudanças efetivas continuam pela **REST API** de registros (não duplicar CRUD no bridge). O bridge é
sobre **conexão, presença e atividade**, não sobre dados.

**Critério de pronto:** agente conecta, aparece como "conectado", e seus eventos ficam registrados.

### M3 · UI — Settings → Agents

**Meta:** tela que mostra os agentes conectados e o que fazem (estilo Proof).

Estende as superfícies de Settings existentes (`pages/settings/developers`, `.../applications`):

- **Lista de agentes** (`ConnectedAgent`): nome, status, **presença** (derivada de `lastSeenAt`:
  ex. "conectado" se < 60s), role.
- **Fluxo conectar/emitir token:** criar agente → escolher/gerar role → exibir o token **uma vez**
  (reuso do padrão da tela de API keys).
- **Feed de atividade por agente:** timeline de `AgentActivity` + as ações reais de proveniência
  (registros criados/editados por aquele agente).

**Critério de pronto:** operador vê seus agentes, status de conexão e o histórico de prompts/ações.

---

## 5. Segurança

- Agentes são confiáveis (do próprio operador), mas cada um roda sob uma **Role de permissões
  mínimas** — o escopo é dado pela role, não pelo agente.
- Token exibido **uma única vez** na criação (padrão das API keys).
- `status: DISABLED` desativa o agente sem apagar histórico; revogar = desativar a API key.
- Bridge não expõe CRUD próprio — reduz superfície; dados sempre pela REST com a role do token.

## 6. Testes

- **M1:** unit do `build-created-by-from-agent.util` + do ramo no `actor-from-auth-context.service`;
  e2e: escrita via token de agente → assert `createdBy/updatedBy.source === AGENT`.
- **M2:** e2e das rotas do bridge (connect/heartbeat/events) com auth por API key; assert
  `lastSeenAt` e `AgentActivity`.
- **M3:** stories/testes de componente da lista, presença e feed.

## 7. Riscos / decisões em aberto

- `FieldActorSource.AGENT` pode já ser usado pelos agentes de IA internos do Twenty; distinção fica
  pelo `name` + `context.connectedAgentId`. (Aceitável.)
- Presença simples via `lastSeenAt` (polling/heartbeat), **não** websockets — coerente com o modelo
  HTTP do Proof e evita infra de realtime na v1.
- Manter o `ConnectedAgent` **separado** do `AgentEntity` interno para não herdar o runtime de IA do
  Twenty (modelo/prompt/execução), que não se aplica a agente externo.

---

## Verificação M1 (2026-07-16)

Executado contra o servidor rodando do fonte (localhost:3000), com token de API key gerado via
`workspace:generate-api-key` e um `ConnectedAgent` (ProofBot) ligado à key. Resultados reais:

- **Agente cria registro** → `createdBy = AGENT / ProofBot`, `createdByContext = {"connectedAgentId": "..."}`.
- **Agente edita registro** → `updatedBy = AGENT / ProofBot`.
- **Não-regressão** — API key comum (sem ConnectedAgent) cria registro → `createdBy = API / <nome da key>`.
- **Boot/DI**: servidor sobe limpo (healthz 200) após corrigir o import de `PermissionsModule` no
  `ConnectedAgentProvisioningModule` (o `nx build` não pega erro de DI; só o boot pega).

Escopo verificado end-to-end: identidade do agente + proveniência de create e update (Tasks 1–4) e a
resolução de DI da mutation de provisionamento (Task 5). A chamada da mutation `createConnectedAgent`
com um JWT de usuário admin não foi exercida (exige login de usuário); está coberta por unit tests
(incluindo o rollback da key e o token-uma-vez), pelo boot com DI válida e pela presença do guard de
permissão. Dados e credenciais de teste foram removidos após a verificação.

---

## Verificação M2 (2026-07-17)

Executado contra o servidor rodando do fonte (localhost:3000). Resultados reais:

- **Boot limpo** (healthz 200, sem `UnknownDependenciesException`) — DI de `AgentSessionGuardModule` (6 hooks) + `AgentBridgeModule` OK.
- **Escrita sem sessão → BLOQUEADA:** `POST /rest/companies` com token de agente sem `lastSeenAt` → `{"code":"PERMISSION_DENIED","messages":["Agent must connect to the bridge before writing"]}` (HTTP 400); company NÃO criada.
- **`connect` → escrita PASSA:** `POST /agent-bridge/connect` → `{connectedAgentId, name:"M2Bot", sessionTtlMs:300000, connectedAt}`; em seguida `POST /rest/companies` → 201, `createdBy = AGENT / M2Bot` (proveniência do M1 intacta).
- **`events` grava atividade:** `POST /agent-bridge/events` → 202; `core.agentActivity` = `PROMPT | user asked to create a company`.
- **Expiração → bloqueia → heartbeat → passa:** envelhecer `lastSeenAt` (−10min) → escrita 400; `POST /agent-bridge/heartbeat` → 204; escrita → 201.
- **Não-regressão:** API key comum (sem `ConnectedAgent`) escreve sem qualquer sessão → 201, `createdBy = API`.

Dados e credenciais de teste removidos; servidor encerrado após a verificação.

### Fix pós-review (final whole-branch review): gate cobria só soft-delete
O review final pegou que o gate cobria `create/update/delete` mas NÃO `destroyOne/destroyMany/mergeMany/restoreOne/restoreMany` — e o `DELETE /rest/...` **padrão** (sem `?soft_delete=true`) é um hard `destroyOne`. Ou seja, um agente sem sessão ainda podia **apagar registros de verdade**. Corrigido (commit 06c29041a8): +5 hooks, totalizando 11 (todas as operações mutantes). Re-verificado e2e: com sessão expirada, `DELETE /rest/companies/:id` → 400 `PERMISSION_DENIED`, registro preservado; após `heartbeat` → DELETE 200. Leituras seguem livres.
