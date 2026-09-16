# Spec — Branding colaborato.rio no fork do Twenty

- **Data:** 2026-09-16
- **Branch base:** `dev` (Twenty v2.42.0 + BYOA)
- **Status:** aprovada; revisada no planejamento (logo, cor blue, tema padrão)

## 1. Contexto e objetivo

O fork `alexandrelt44/twenty` já é usado internamente pela colaborato.rio e vai ser
oferecido a clientes como **o CRM da colaborato.rio** (clientes plugam seus agentes via
Connected Agents / BYOA). Não há branding por cliente: existe **uma única marca**.

Objetivo: aplicar uma **identidade leve** da colaborato.rio (nome, logo, favicon, cor de
destaque, fonte, título da aba, e-mails, tela de login) mantendo o custo de merge com o
upstream baixo, e publicar a versão branded (com BYOA) numa imagem própria rodando na
VPS openclaw (`https://crm.colaborato.rio`).

### Decisões tomadas

| Tema | Decisão |
|---|---|
| Público | Uso interno + clientes; marca única, sem white-label por cliente |
| Profundidade | Identidade leve (sem mexer em cinzas, superfícies, raios, layout) |
| Ativos | Guia de marca em `~/Projetos/colaboratorio` |
| Tema | Default continua `System` (como hoje); nenhuma mudança de tema padrão (revisado no planejamento) |
| Logo | Só o ícone da lâmpada (favicon) em todos os slots; wordmark não entra no app (revisado) |
| Cor primária | Sobrescrever também a escala `--t-color-blue*` (botões primários usam blue) (revisado) |
| Publicação | Imagem Docker própria no GHCR via GitHub Actions |
| Arquitetura | Camada de marca isolada sobrescrevendo tokens (abordagem 1) |

### Fora de escopo

- Paleta de cinzas/superfícies, raios, densidade, ícones, ilustrações, empty states.
- Mudanças de layout, navegação, home ou onboarding.
- Branding configurável por env / multi-marca.
- Configuração de SMTP na VPS (recomendada, mas plano separado).
- Strings técnicas que referenciam a plataforma Twenty (instruções de MCP, billing,
  enterprise, "Twenty fields").

## 2. Fonte dos ativos da marca

De `~/Projetos/colaboratorio/Guia de Marca colaborato.rio.md` e `landing-page/`:

- **Nome:** `colaborato.rio` — sempre minúsculas.
- **Logo:** `landing-page/public/assets/colaboratorio-logo.png` (801×481, ícone de lâmpada
  + wordmark empilhado em gradiente rosa/roxo — difere da descrição do guia). Não usado no
  app (ver Seção 2). Regra: usar arquivos originais, sem recriar.
- **Ícone:** `landing-page/dist/assets/favicon.png` (512×512, lâmpada em círculo escuro) —
  fonte de todos os ícones do app.
- **Cores:** primária Neon Purple `#D8B4FE`; secundárias `#F472B6`, `#60A5FA`, `#22C55E`.
- **Tipografia:** Outfit (texto), JetBrains Mono (código/dados).

## 3. Arquitetura — camada de marca isolada

Todo o código específico da marca vive em locais próprios do fork. Os arquivos do
upstream tocados são poucos, com mudanças de uma ou poucas linhas, listados em
`BRANDING.md` (raiz do fork) para orientar merges.

```
packages/twenty-front/src/modules/brand/
  colaboratorio-theme.css                  # overrides de tokens (.light / .dark) + fonte do body
  constants/BrandIdentity.ts               # nome, site, repo, URL do ícone
  components/BrandSourceAttribution.tsx    # atribuição AGPL em Settings
  __tests__/colaboratorioTheme.test.ts     # variáveis existem + contraste WCAG
packages/twenty-front/scripts/brand/
  brand-icon-source.png                    # favicon original da marca (512px)
  generate-brand-icons.sh                  # regenera public/images/icons/* (sips)
BRANDING.md                                # inventário de pontos de contato com o upstream
.github/workflows/fork-build-image.yaml
```

## 4. Seção 1 — Tokens e tema

- `colaboratorio-theme.css` é importado **uma vez**, depois do CSS de tema do
  `twenty-ui` (`theme-light.css` / `theme-dark.css`), para vencer por ordem de cascata
  com a mesma especificidade (`.light` / `.dark`).
- **Blue:** botões primários usam `--t-color-blue*`, então `--t-color-blue` e
  `--t-color-blue1…12` recebem a mesma escala roxa. Tags/opções "blue" escolhidas pelo
  usuário têm variáveis próprias (`--t-tag-*-blue`) e continuam azuis.
- **Accent:** substitui `--t-accent-accent1…12` e os aliases derivados
  (`--t-accent-primary`, `secondary`, `tertiary`, `quaternary`, `accent3570`,
  `accent4060`) por uma escala roxa de 12 passos, uma para `.dark` e outra para `.light`,
  derivada da escala Radix Purple e ajustada para que `#D8B4FE` seja o tom de destaque.
  - **Escuro:** `#D8B4FE` como destaque (bordas ativas, seleção, links); o passo sólido
    (botões com texto branco) usa um roxo mais saturado.
  - **Claro:** lavanda só em fundos suaves; texto e sólidos em roxo escuro
    (`#7E22CE` / `#9333EA`).
  - Todo par texto/fundo resultante precisa passar **WCAG AA** (4.5:1 texto normal,
    3:1 elementos de UI). A verificação faz parte da implementação.
- **Fontes:** `--t-font-family: Outfit, sans-serif`;
  `--t-code-font-family: 'JetBrains Mono', monospace`. Fontes servidas localmente via
  `@fontsource` (pesos 400/500/600/700 do Outfit; 400 do JetBrains Mono), sem CDN.
- **Não muda:** cinzas, superfícies, bordas, raios, espaçamentos.
- **Guarda de merge:** `colaboratorioTheme.test.ts` lê os CSS gerados do `twenty-ui` e falha
  se alguma variável sobrescrita pela marca deixar de existir.
- **Risco conhecido:** Outfit é mais largo que Inter — checar truncamento em tabelas e
  sidebar no checklist visual.

## 5. Seção 2 — Logo e favicon

Revisado no planejamento: o logo real é um ícone de lâmpada + wordmark empilhado, e todos
os slots de logo do app são quadrados e pequenos (login 48px, avatar do workspace,
favicon, e-mail). Usa-se **só o ícone** (lâmpada em círculo escuro, 512px), que funciona
igual em claro e escuro, sem filtro. O wordmark não entra no app.

- **Ícones de app** (`public/images/icons/android|ios|windows11`, 112 PNGs) regenerados
  a partir do ícone da marca por `scripts/brand/generate-brand-icons.sh`, **com os mesmos
  nomes e dimensões**, sem alterar caminhos em `index.html` e `manifest.json`.
- **Login:** `auth/components/Logo.tsx` já usa `android-launchericon-192-192.png` como
  placeholder, portanto passa a exibir o ícone da marca sem mudança de código.
  Workspaces com logo próprio continuam exibindo o seu.
- **Sidebar / seletor de workspace / favicon dinâmico:** `DEFAULT_WORKSPACE_LOGO` deixa
  de apontar para `twentyhq.github.io/.../twenty-logo.png` e passa a apontar para o
  ícone local `${window.location.origin}/images/icons/android/android-launchericon-192-192.png` (absoluto, pois `getImageAbsoluteURI` reescreve caminhos relativos para `/files`).
- **Tema padrão:** continua `System` (sem mudança).

## 6. Seção 3 — Textos e e-mails

### Navegador / PWA

- `index.html`: `<title>`, `og:title`, `twitter:title` e descrições → `colaborato.rio`.
- `public/manifest.json`: `name`, `short_name` → `colaborato.rio`.

### Strings da interface (apenas 2)

- "Welcome to Twenty" → "Welcome to colaborato.rio"
- "Page Not Found | Twenty" → "Page Not Found | colaborato.rio"

"By using Twenty, you agree to the Terms of Service…" (`FooterNote.tsx`) **fica como
está** (revisado no planejamento): o texto linka os termos do Twenty, e trocar só o nome
apontaria o usuário para termos de outra empresa. Revisitar quando colaborato.rio tiver
páginas legais próprias.

Mensagens-fonte editadas e traduções atualizadas em **en, pt-BR, pt-PT**. Demais
locales caem em inglês nessas entradas (aceito). Esta é uma exceção deliberada à regra
de "não commitar catálogos": commitar apenas as entradas afetadas nesses locales. Conflitos
futuros nos `.po` são resolvidos aceitando o upstream e reaplicando.

### E-mails (`packages/twenty-emails`)

- `components/Logo.tsx`: `src` passa a ser o ícone da marca servido pela instância
  (`https://crm.colaborato.rio/images/icons/windows11/Square150x150Logo.scale-100.png`,
  mesmo caminho que o upstream usa em app.twenty.com), `alt="colaborato.rio logo"`.
- `components/Footer.tsx`: links do Twenty → site colaborato.rio; "Twenty.com, Public
  Benefit Corporation" → "colaborato.rio"; linha de atribuição AGPL (ver abaixo).
- `components/WhatIsTwenty.tsx` (convite): "What is Twenty?" → "O que é o
  colaborato.rio?" / "What is colaborato.rio?" com texto da marca.
- `components/BaseHead.tsx`: `<title>` → `colaborato.rio`.
- Remetente: `EMAIL_FROM_NAME` é config da VPS, não código.

### Licença (AGPLv3)

- `LICENSE` intacto; arquivos `@license Enterprise` não tocados.
- Atribuição + oferta de código-fonte (AGPL §13, uso via rede): linha discreta
  "Construído sobre Twenty (open source) · código-fonte" com link para
  `https://github.com/alexandrelt44/twenty`, no rodapé dos e-mails e em Settings.

## 7. Seção 4 — Build, imagem e deploy

### Branches

- `dev`: desenvolvimento (BYOA + marca).
- `release`: produção; push dispara build da imagem.
- Sync com upstream: merge de `upstream/main` em `dev` (rotina), seguindo `BRANDING.md`.

### Build

- Workflow exclusivo do fork `.github/workflows/fork-build-image.yaml`, com trigger em
  push para `release` e `workflow_dispatch`.
- Usa `packages/twenty-docker/twenty/Dockerfile` **sem modificações**, `linux/amd64`,
  cache do GitHub Actions.
- Publica em `ghcr.io/alexandrelt44/colaboratorio-crm` com tags `release`,
  `<twentyVersion>-colab.<run>` e `sha-<shortsha>`.
- Workflows herdados do upstream ficam **desabilitados** no fork (`gh workflow disable`),
  sem apagar arquivos, para não gerar conflitos; só `fork-build-image` fica ativo.

### Deploy na VPS openclaw

Estado atual: `x86_64`, 7.8 GB RAM, Twenty v2.2.0 oficial, compose em
`/home/openclaw/.openclaw/workspace/apps/twenty`, sem `ENCRYPTION_KEY`, SMTP desligado.

1. **Backup:** `pg_dumpall` do `twenty-db-1` + cópia do volume
   `twenty_server-local-data`.
2. **Definir `ENCRYPTION_KEY`** no `.env` (e repassar no compose para server e worker)
   antes do primeiro boot ≥ v2.5.
3. Trocar `image:` de server e worker para
   `ghcr.io/alexandrelt44/colaboratorio-crm:${TAG}` e `TAG` para a tag de release.
   Autenticar a VPS no GHCR se o pacote for privado.
4. `docker compose pull && docker compose up -d` — o entrypoint executa o upgrade
   (cross-version suportado desde v1.23), incluindo os upgrade commands BYOA 2-42.
5. Verificar `yarn command:prod upgrade:status` e smoke test (login, sidebar, Connected
   Agents, ícone, ambos os temas).
6. **Rollback:** restaurar `image`/`TAG` anteriores e o dump (upgrades não são revertidos
   automaticamente).

## 8. Testes e verificação

- `colaboratorioTheme.test.ts`: variáveis sobrescritas existem nos CSS do `twenty-ui` e
  pares de cor passam WCAG AA.
- Teste de componente de `BrandSourceAttribution` (texto e link do repositório).
- Script de ícones valida que cada PNG regenerado mantém as dimensões originais.
- Snapshot/render de e-mails do upstream atualizado para a marca.
- Typecheck (`tsgo`) e lint nos pacotes tocados (front, emails, server se aplicável).
- Checklist visual manual (app rodando, ambos os temas): login, sidebar, tabela, botão
  primário, página de settings, 404, e-mail de convite renderizado.
- Contraste WCAG AA das combinações accent × fundo nos dois temas.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Upstream renomeia tokens e override silencia | `colaboratorioTheme.test.ts` |
| Conflitos em `.po` a cada merge | Só 3 entradas; resolução documentada em `BRANDING.md` |
| Outfit trunca textos | Checklist visual; ajuste de tamanho se necessário |
| Upgrade v2.2 → v2.42 falha na VPS | Backup obrigatório + rollback documentado |
| Build do Dockerfile no Actions excede limites (tempo/disco) | Cache; se necessário, runner maior ou build local + push |
