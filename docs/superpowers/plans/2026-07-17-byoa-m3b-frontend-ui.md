# BYOA M3b — Frontend UI "Connected Agents" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Uma seção de topo "Connected Agents" em Settings que lista os agentes (com status ACTIVE/DISABLED + presença por `lastSeenAt` + role), cria agente (mostrando o token uma vez), e num detalhe permite desativar/reativar, excluir e ver o feed de atividade — consumindo o GraphQL do M3a.

**Architecture:** Espelha a feature de API Keys do Twenty (a análoga: api-key-backed, mesma permissão). Documentos `gql` à mão em `modules/settings/**/graphql/` → codegen metadata → `useQuery`/`useMutation` com os `XxxDocument` tipados. Rotas lazy + `SettingsProtectedRouteWrapper` gated por `API_KEYS_AND_WEBHOOKS`. Componentes do design system do Twenty (Table, `Status` pill, `ConfirmationModal`, etc.).

**Tech Stack:** React, Apollo Client, GraphQL Codegen, Jotai, styled-components, `twenty-ui`, Nx. Sobre M1/M2/M3a (branch `dev`).

## Global Constraints
- Repo `~/Projetos/twenty`, branch `dev`. Commitar nesta branch. M1/M2/M3a mergeados.
- **NÃO inventar estética** — espelhar as páginas de Settings existentes (design system do Twenty). Consistência > originalidade.
- Permissão: reusar `PermissionFlagType.API_KEYS_AND_WEBHOOKS` nos 4 pontos (rota `SettingsProtectedRouteWrapper`, nav `isHidden`, e o backend já gateia). NÃO criar flag novo.
- GraphQL schema = **metadata** (o resolver do M3a é `@MetadataResolver`). Docs gql sob `modules/settings/**/graphql/` são pegos pelo `codegen-metadata.cjs`; tipos gerados em `~/generated-metadata/graphql`.
- **Codegen precisa do backend rodando** (introspção do schema ao vivo em `http://localhost:3000`). Comando: `npx nx run twenty-front:graphql:generate --configuration=metadata`. Os passos de codegen e a verificação visual são **executados pelo controller** (servidor no ar), não por subagente (evita servidor órfão).
- Build do front: `npx nx run twenty-front:build` (valida TS/compilação). Rodar após mudanças de código.
- **Comportamento do M3a que a UI DEVE respeitar:** "excluir" revoga a API key; "desativar" bloqueia as escritas do agente (reversível); renderizar `AgentActivity.payload` como **texto inerte** (nunca HTML) — precaução de stored-XSS.
- Import aliases do front: `@/...` (src/modules), `~/...` (src/), `twenty-ui/*`, `twenty-shared/*`.
- Fonte da verdade a espelhar (ler antes de escrever cada página):
  - Lista: `packages/twenty-front/src/pages/settings/workspace/SettingsApiWebhooks.tsx` + `modules/settings/developers/components/SettingsApiKeysTable.tsx` + `SettingsApiKeysFieldItemTableRow.tsx`.
  - Criar+token: `packages/twenty-front/src/pages/settings/developers/api-keys/SettingsDevelopersApiKeysNew.tsx` + `modules/settings/developers/components/{ApiKeyInput,ApiKeyNameInput,SettingsDevelopersRoleSelector}.tsx` + `states/apiKeyTokenFamilyState.ts`.
  - Detalhe+danger: `packages/twenty-front/src/pages/settings/developers/api-keys/SettingsDevelopersApiKeyDetail.tsx`.
  - Docs gql: `modules/settings/developers/graphql/{queries,mutations,fragments}/*.ts`.
  - Rotas: `modules/app/components/SettingsRoutes.tsx`. Nav: `modules/settings/hooks/useSettingsNavigationItems.tsx`. Paths: `packages/twenty-shared/src/types/SettingsPath.ts`.

## File Structure
**Novos (front):**
- `modules/settings/connected-agents/graphql/fragments/connectedAgentFragment.ts`
- `modules/settings/connected-agents/graphql/queries/{getConnectedAgents,getConnectedAgent,getConnectedAgentActivity}.ts`
- `modules/settings/connected-agents/graphql/mutations/{createConnectedAgent,setConnectedAgentStatus,deleteConnectedAgent}.ts`
- `modules/settings/connected-agents/states/connectedAgentTokenFamilyState.ts`
- `modules/settings/connected-agents/components/{ConnectedAgentsTable,ConnectedAgentStatusCell,ConnectedAgentActivityFeed}.tsx`
- `pages/settings/connected-agents/{SettingsConnectedAgents,SettingsConnectedAgentNew,SettingsConnectedAgentDetail}.tsx`
**Modificar:**
- `packages/twenty-shared/src/types/SettingsPath.ts` — 3 entries.
- `modules/settings/hooks/useSettingsNavigationItems.tsx` — seção de topo "Connected Agents".
- `modules/app/components/SettingsRoutes.tsx` — lazy imports + rotas.
- `~/generated-metadata/graphql.ts` — regenerado por codegen (não editar à mão).

---

## Task 1: Scaffolding — SettingsPath + nav + rotas (com páginas stub)

**Files:** SettingsPath.ts, useSettingsNavigationItems.tsx, SettingsRoutes.tsx, 3 páginas stub.

**Interfaces:**
- Produces: `SettingsPath.ConnectedAgents = 'connected-agents'`, `SettingsPath.NewConnectedAgent = 'connected-agents/new'`, `SettingsPath.ConnectedAgentDetail = 'connected-agents/:connectedAgentId'`; a seção de nav; as 3 rotas; 3 páginas stub que renderizam um placeholder (substituídas nas Tasks 3-5).

- [ ] **Step 1: SettingsPath**

Em `packages/twenty-shared/src/types/SettingsPath.ts`, adicionar ao enum (perto de `ApiWebhooks`, seguindo o estilo):
```ts
  ConnectedAgents = 'connected-agents',
  NewConnectedAgent = 'connected-agents/new',
  ConnectedAgentDetail = 'connected-agents/:connectedAgentId',
```

- [ ] **Step 2: Páginas stub**

Criar 3 arquivos mínimos que compilam e renderizam um placeholder (serão substituídos). Modelo — `pages/settings/connected-agents/SettingsConnectedAgents.tsx`:
```tsx
export const SettingsConnectedAgents = () => {
  return <div>Connected Agents</div>;
};
```
Idem `SettingsConnectedAgentNew.tsx` (export `SettingsConnectedAgentNew`) e `SettingsConnectedAgentDetail.tsx` (export `SettingsConnectedAgentDetail`).

- [ ] **Step 3: Nav — seção de topo "Connected Agents"**

Em `modules/settings/hooks/useSettingsNavigationItems.tsx`, o hook retorna um array de `{ label, items }`. Adicionar uma nova **seção** logo após a seção `Workspace` (onde vive "APIs & Webhooks") e antes de `Other`:
```tsx
    {
      label: t`Connected Agents`,
      items: [
        {
          label: t`Connected Agents`,
          path: SettingsPath.ConnectedAgents,
          Icon: IconRobot,
          isHidden: !permissionMap[PermissionFlagType.API_KEYS_AND_WEBHOOKS],
        },
      ],
    },
```
> Importar `IconRobot` de `twenty-ui/display` (confirmar que existe; senão usar `IconApi` ou `IconPlug`, já importados no arquivo). Não duplicar imports.

- [ ] **Step 4: Rotas**

Em `modules/app/components/SettingsRoutes.tsx`: adicionar os 3 lazy imports (seguindo o padrão `const X = lazy(() => import('~/pages/...').then((module) => ({ default: module.X })))`) e, dentro de um bloco `<SettingsProtectedRouteWrapper settingsPermission={PermissionFlagType.API_KEYS_AND_WEBHOOKS}>` (mirror do bloco de api-keys ~linhas 717-748), as rotas:
```tsx
<Route path={SettingsPath.ConnectedAgents} element={<SettingsConnectedAgents />} />
<Route path={SettingsPath.NewConnectedAgent} element={<SettingsConnectedAgentNew />} />
<Route path={SettingsPath.ConnectedAgentDetail} element={<SettingsConnectedAgentDetail />} />
```
> Ler o bloco real de api-keys nesse arquivo e espelhar exatamente (o wrapper, o agrupamento). Se as rotas do api-keys estão repartidas em dois blocos de permissão diferentes, colocar as 3 do Connected Agents juntas no bloco `API_KEYS_AND_WEBHOOKS`.

- [ ] **Step 5: Build**

Run (controller): `cd ~/Projetos/twenty && npx nx run twenty-front:build`
Expected: compila sem erro TS. (`SettingsPath` é de `twenty-shared` — se o build reclamar de tipo desatualizado, rebuildar `twenty-shared`: `npx nx build twenty-shared`.)

- [ ] **Step 6: Commit**
```bash
cd ~/Projetos/twenty
git add packages/twenty-shared/src/types/SettingsPath.ts packages/twenty-front/src/modules/settings/hooks/useSettingsNavigationItems.tsx packages/twenty-front/src/modules/app/components/SettingsRoutes.tsx packages/twenty-front/src/pages/settings/connected-agents
git commit -m "feat(byoa-ui): scaffold Connected Agents settings section, routes, nav"
```

---

## Task 2: Documentos GraphQL + codegen

**Files:** os fragments/queries/mutations em `modules/settings/connected-agents/graphql/`. Codegen regenera `~/generated-metadata/graphql`.

**Interfaces:**
- Produces (após codegen): `GetConnectedAgentsDocument`, `GetConnectedAgentDocument`, `GetConnectedAgentActivityDocument`, `CreateConnectedAgentDocument`, `SetConnectedAgentStatusDocument`, `DeleteConnectedAgentDocument` em `~/generated-metadata/graphql`.

- [ ] **Step 1: Fragment**

`.../graphql/fragments/connectedAgentFragment.ts` (mirror `apiKeyFragment.ts`):
```ts
import gql from 'graphql-tag';

export const CONNECTED_AGENT_FRAGMENT = gql`
  fragment ConnectedAgentFragment on ConnectedAgent {
    id
    name
    description
    status
    lastSeenAt
    createdAt
    role {
      id
      label
      icon
    }
  }
`;
```

- [ ] **Step 2: Queries**

`getConnectedAgents.ts`:
```ts
import gql from 'graphql-tag';
import { CONNECTED_AGENT_FRAGMENT } from '@/settings/connected-agents/graphql/fragments/connectedAgentFragment';

export const GET_CONNECTED_AGENTS = gql`
  query GetConnectedAgents {
    connectedAgents {
      ...ConnectedAgentFragment
    }
  }
  ${CONNECTED_AGENT_FRAGMENT}
`;
```
`getConnectedAgent.ts`:
```ts
import gql from 'graphql-tag';
import { CONNECTED_AGENT_FRAGMENT } from '@/settings/connected-agents/graphql/fragments/connectedAgentFragment';

export const GET_CONNECTED_AGENT = gql`
  query GetConnectedAgent($input: GetConnectedAgentInput!) {
    connectedAgent(input: $input) {
      ...ConnectedAgentFragment
    }
  }
  ${CONNECTED_AGENT_FRAGMENT}
`;
```
`getConnectedAgentActivity.ts`:
```ts
import gql from 'graphql-tag';

export const GET_CONNECTED_AGENT_ACTIVITY = gql`
  query GetConnectedAgentActivity($input: GetConnectedAgentActivityInput!) {
    connectedAgentActivity(input: $input) {
      id
      type
      summary
      payload
      createdAt
    }
  }
`;
```

- [ ] **Step 3: Mutations**

`createConnectedAgent.ts`:
```ts
import gql from 'graphql-tag';

export const CREATE_CONNECTED_AGENT = gql`
  mutation CreateConnectedAgent($input: CreateConnectedAgentInput!) {
    createConnectedAgent(input: $input) {
      connectedAgent {
        id
        name
      }
      token
    }
  }
`;
```
`setConnectedAgentStatus.ts`:
```ts
import gql from 'graphql-tag';

export const SET_CONNECTED_AGENT_STATUS = gql`
  mutation SetConnectedAgentStatus($input: SetConnectedAgentStatusInput!) {
    setConnectedAgentStatus(input: $input) {
      id
      status
    }
  }
`;
```
`deleteConnectedAgent.ts`:
```ts
import gql from 'graphql-tag';

export const DELETE_CONNECTED_AGENT = gql`
  mutation DeleteConnectedAgent($input: DeleteConnectedAgentInput!) {
    deleteConnectedAgent(input: $input)
  }
`;
```

- [ ] **Step 4: Codegen (controller, backend no ar)**

Controller: subir o backend (`yarn start`, aguardar healthz 200), então:
`cd ~/Projetos/twenty && npx nx run twenty-front:graphql:generate --configuration=metadata`
Expected: `~/generated-metadata/graphql.ts` regenerado, contendo `GetConnectedAgentsDocument`, `GetConnectedAgentDocument`, `GetConnectedAgentActivityDocument`, `CreateConnectedAgentDocument`, `SetConnectedAgentStatusDocument`, `DeleteConnectedAgentDocument`. Verificar: `grep -c "ConnectedAgentDocument" packages/twenty-front/src/generated-metadata/graphql.ts` > 0. Depois matar o servidor.

- [ ] **Step 5: Commit**
```bash
cd ~/Projetos/twenty
git add packages/twenty-front/src/modules/settings/connected-agents/graphql packages/twenty-front/src/generated-metadata/graphql.ts
git commit -m "feat(byoa-ui): add Connected Agents gql documents and regenerate types"
```

---

## Task 3: Página de LISTA

**Files:** substituir a stub `pages/settings/connected-agents/SettingsConnectedAgents.tsx`; criar `components/ConnectedAgentsTable.tsx` + `ConnectedAgentStatusCell.tsx`.

**Interfaces:** Consumes `GetConnectedAgentsDocument`. A página tem o chrome de settings (`SubMenuTopBarContainer`/`SettingsPageContainer`) + botão "New agent" → `SettingsPath.NewConnectedAgent`, e a tabela.

- [ ] **Step 1: Ler os templates** `SettingsApiWebhooks.tsx` (a parte de API Keys) e `SettingsApiKeysTable.tsx` + `SettingsApiKeysFieldItemTableRow.tsx`. Espelhar.

- [ ] **Step 2: `ConnectedAgentsTable.tsx`** — mirror `SettingsApiKeysTable.tsx`: `useQuery(GetConnectedAgentsDocument)`, `<Table>` com header (Name, Status, Last seen, Role) e uma linha por agente (`TableRow` com `to={getSettingsPath(SettingsPath.ConnectedAgentDetail, { connectedAgentId: agent.id })}`). Célula de status usa `ConnectedAgentStatusCell`. "Last seen" usa `beautifyPastDateRelativeToNowShort(new Date(agent.lastSeenAt))` (de `~/utils/date-utils`) quando `lastSeenAt` existe, senão "Never". Role via `agent.role?.label`.

- [ ] **Step 3: `ConnectedAgentStatusCell.tsx`** — usa o `Status` pill de `twenty-ui/display`. Regra:
  - `status === 'DISABLED'` → `<Status color="gray" text="Disabled" />`.
  - `status === 'ACTIVE'` e sessão ativa (`lastSeenAt` e `Date.now() - new Date(lastSeenAt) < 300000`) → `<Status color="green" text="Connected" />`.
  - `status === 'ACTIVE'` e sessão inativa → `<Status color="orange" text="Idle" />`.
  > Confirmar a assinatura/props reais do `Status` (`color: ThemeColor, text: string`) lendo `packages/twenty-ui/src/display/status/components/Status.tsx`. O `300000` (5min = TTL da sessão) pode virar uma const local.

- [ ] **Step 4: `SettingsConnectedAgents.tsx`** — mirror da seção de página do `SettingsApiWebhooks.tsx`: `SubMenuTopBarContainer` com breadcrumb "Connected Agents" e um `actionButton` (ícone +) que navega pra `NewConnectedAgent`; corpo = `<Section>` com `H2Title` + `<ConnectedAgentsTable />`.

- [ ] **Step 5: Build**

Run (controller): `cd ~/Projetos/twenty && npx nx run twenty-front:build` → sem erro TS.

- [ ] **Step 6: Commit**
```bash
cd ~/Projetos/twenty
git add packages/twenty-front/src/pages/settings/connected-agents/SettingsConnectedAgents.tsx packages/twenty-front/src/modules/settings/connected-agents/components
git commit -m "feat(byoa-ui): Connected Agents list page with status + presence"
```

---

## Task 4: Página NEW (criar + token uma vez)

**Files:** substituir stub `SettingsConnectedAgentNew.tsx`; criar `states/connectedAgentTokenFamilyState.ts`.

**Interfaces:** Consumes `CreateConnectedAgentDocument`, `GetRolesDocument` (existente, pro role selector). Cria o agente e guarda o `token` no atomFamily pra exibir no detalhe.

- [ ] **Step 1: Ler** `SettingsDevelopersApiKeysNew.tsx` + `states/apiKeyTokenFamilyState.ts` + `SettingsDevelopersRoleSelector.tsx`.

- [ ] **Step 2: `connectedAgentTokenFamilyState.ts`** — mirror `apiKeyTokenFamilyState.ts` (`createAtomFamilyState<string | null, string>({ key: 'connectedAgentTokenState', defaultValue: null })`).

- [ ] **Step 3: `SettingsConnectedAgentNew.tsx`** — mirror `SettingsDevelopersApiKeysNew.tsx`, mas **mais simples** (nossa `createConnectedAgent` já retorna o token direto — NÃO há segunda mutation de token). Form: input de nome (mirror `ApiKeyNameInput` ou um `SettingsTextInput`), `SettingsDevelopersRoleSelector` (buscar roles com `useQuery(GetRolesDocument)` como o detail de api-key faz), e um `expiresAt` (a mutation exige — usar um default, ex.: 1 ano a partir de agora, ou um seletor simples; mirror como api-keys resolve o expiresAt). Ao salvar: `createConnectedAgent({ variables: { input: { name, roleId, expiresAt } } })` → pegar `data.createConnectedAgent.token` + `.connectedAgent.id` → `jotaiStore.set(connectedAgentTokenFamilyState.atomFamily(id), token)` → navegar pra `SettingsPath.ConnectedAgentDetail`.
  > `CreateConnectedAgentInput` (M1) exige `name`, `roleId`, `expiresAt` (ISO string), `description?`. Confirmar no schema/DTO.

- [ ] **Step 4: Build + commit**
```bash
cd ~/Projetos/twenty && npx nx run twenty-front:build   # sem erro TS
git add packages/twenty-front/src/pages/settings/connected-agents/SettingsConnectedAgentNew.tsx packages/twenty-front/src/modules/settings/connected-agents/states
git commit -m "feat(byoa-ui): create Connected Agent flow with one-time token"
```

---

## Task 5: Página DETALHE (status toggle + delete + feed)

**Files:** substituir stub `SettingsConnectedAgentDetail.tsx`; criar `components/ConnectedAgentActivityFeed.tsx`.

**Interfaces:** Consumes `GetConnectedAgentDocument`, `SetConnectedAgentStatusDocument`, `DeleteConnectedAgentDocument`, `GetConnectedAgentActivityDocument`, `connectedAgentTokenFamilyState`.

- [ ] **Step 1: Ler** `SettingsDevelopersApiKeyDetail.tsx` (o padrão de detalhe + danger zone + `ConfirmationModal`).

- [ ] **Step 2: `SettingsConnectedAgentDetail.tsx`** — mirror do detail de api-key:
  - `useParams()` → `connectedAgentId`; `useQuery(GetConnectedAgentDocument, { variables: { input: { id } } })`.
  - **Token uma vez:** ler `useAtomFamilyStateValue(connectedAgentTokenFamilyState, id)`; se presente, renderizar um `ApiKeyInput`-like ("Copy this token, it won't be shown again") — pode reusar `ApiKeyInput` (`@/settings/developers/components/ApiKeyInput`) passando o token; se ausente, não mostrar (nosso token não é regerável — omitir o botão "Regenerate").
  - Campos read-only: nome, role (`agent.role?.label`), status, "last seen".
  - **Toggle de status:** um `Toggle`/`Button` que chama `setConnectedAgentStatus({ variables: { input: { id, status: agent.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' } } })` e refetch. Label deixando claro: desativar **bloqueia as escritas** do agente.
  - **Danger zone / Delete:** `ConfirmationModal` (mirror; exige digitar "yes") → `deleteConnectedAgent({ variables: { input: { id } } })` → navegar pra `SettingsPath.ConnectedAgents`. O texto do modal DEVE dizer que excluir **revoga a API key do agente** (acesso removido de vez).
  - **Feed:** `<ConnectedAgentActivityFeed connectedAgentId={id} />`.

- [ ] **Step 3: `ConnectedAgentActivityFeed.tsx`** — `useQuery(GetConnectedAgentActivityDocument, { variables: { input: { connectedAgentId } } })`; renderizar uma lista/tabela: `type` (pill/label), `summary`, `createdAt` (relativo). **`payload` DEVE ser renderizado como texto inerte** — ex.: `JSON.stringify(payload)` dentro de um elemento de texto (nunca via `dangerouslySetInnerHTML`). Se vazio, "No activity yet".

- [ ] **Step 4: Build + commit**
```bash
cd ~/Projetos/twenty && npx nx run twenty-front:build   # sem erro TS
git add packages/twenty-front/src/pages/settings/connected-agents/SettingsConnectedAgentDetail.tsx packages/twenty-front/src/modules/settings/connected-agents/components/ConnectedAgentActivityFeed.tsx
git commit -m "feat(byoa-ui): Connected Agent detail — status toggle, delete, activity feed"
```

---

## Task 6: Verificação visual (controller, no navegador)

**Files:** nenhum. Controller dirige a UI real.

- [ ] **Step 1:** Subir backend + front (`yarn start`), logar em `http://localhost:3001` (`alexandre@desenro.la`).
- [ ] **Step 2:** Nav mostra a seção "Connected Agents" (gated pela permissão). Abrir a lista.
- [ ] **Step 3:** Criar um agente (nome + role) → confirmar que a página de detalhe mostra o **token uma vez**. Copiar o token.
- [ ] **Step 4:** Usar o token via REST (`connect` + `POST /rest/companies`) pra gerar atividade real e uma escrita; reportar o agente um `events`. Voltar à lista → o agente aparece com presença "Connected"/"Idle" + status ACTIVE; o feed no detalhe mostra a atividade.
- [ ] **Step 5:** Desativar pelo toggle → confirmar (via REST com o token) que a escrita agora é **bloqueada**; o pill vira "Disabled". Reativar → escrita volta.
- [ ] **Step 6:** Excluir pelo danger zone (digitar "yes") → agente some da lista; confirmar (via REST) que o token foi **revogado** (não autentica mais).
- [ ] **Step 7:** Screenshot da lista e do detalhe. Limpar dados de teste. Matar o servidor.
- [ ] **Step 8:** Registrar em `## Verificação M3b` no spec e commitar.

---

## Critério de pronto do M3b
A seção "Connected Agents" lista agentes com status+presença, cria com token exibido uma vez, e no detalhe permite desativar (bloqueia escrita), excluir (revoga a key) e ver o feed de atividade — tudo consumindo o GraphQL do M3a, casando com o design system do Twenty.

## Notas
- Codegen e verificação visual são passos do CONTROLLER (servidor no ar); os subagentes fazem os arquivos + `nx run twenty-front:build`.
- Se o `build` do front acusar tipo faltando de `twenty-shared` (SettingsPath), rodar `npx nx build twenty-shared` antes.
