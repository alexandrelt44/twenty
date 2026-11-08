# ColabCRM branding layer

This fork (`alexandrelt44/twenty`) ships ColabCRM, the colaborato.rio CRM. Branding is a thin
layer over upstream Twenty. Spec: `docs/superpowers/specs/2026-09-16-colaboratorio-branding-design.md`.

The product name is `ColabCRM`. `colaborato.rio` is the company and stays where it means the company.
Every product name in code reads `BRAND_IDENTITY` (front) or `BRAND_EMAIL_IDENTITY` (emails and server,
exported from `twenty-emails`), so per-workspace branding can reuse them.

## Brand values

| Item | Value |
|---|---|
| Product | `ColabCRM` |
| Company | `colaborato.rio` |
| Website | `https://colaborato.rio` |
| Privacy policy | `https://colaborato.rio/privacidade` |
| Terms of use | Not published yet (COL-1473), link hidden |
| Interface font | Outfit, sans-serif |
| Code font | JetBrains Mono, monospace |
| Email accent | `#9333EA` |
| Email font | Outfit with sans-serif fallback |
| Accent light | 9 `#9333EA`, 10 `#7E22CE`, 11 `#7E22CE`, 12 `#402060` |
| Accent dark | 9 `#8E4EC6`, 10 `#9A5CD0`, 11 `#D8B4FE`, 12 `#ECD9FA` |
| Manifest and `theme-color` | `#0A0A0F` |
| Icon | `packages/twenty-front/scripts/brand/brand-icon-source.png`, 512x512 |

The full 12-step scale lives in `packages/twenty-front/src/modules/brand/colaboratorio-theme.css`.

## Fork-only files (never conflict)

- `packages/twenty-front/src/modules/brand/**` — theme CSS, identity constant, attribution
- `packages/twenty-front/scripts/brand/**` — icon source + generator, catalog script `apply-brand-catalogs.mjs`, rules `brand-catalog-rules.json`
- `packages/twenty-emails/src/constants/BrandEmailIdentity.ts`
- `.github/workflows/fork-build-image.yaml` — GHCR build workflow
- `BRANDING.md`

## Upstream files touched (may conflict on merge)

| File | Change | On conflict |
|---|---|---|
| `packages/twenty-front/src/index.tsx` | `@fontsource` imports (alphabetical) + brand CSS (last) | Take upstream, re-add `@fontsource` imports alphabetically, then add brand CSS as final import |
| `packages/twenty-front/package.json`, `yarn.lock` | `@fontsource/outfit`, `@fontsource/jetbrains-mono` | Take upstream, `yarn workspace twenty-front add @fontsource/outfit@^5 @fontsource/jetbrains-mono@^5` |
| `packages/twenty-front/public/images/icons/**` | Regenerated brand icons | Take upstream, run `packages/twenty-front/scripts/brand/generate-brand-icons.sh` |
| `packages/twenty-front/index.html` | Title/meta | Take upstream, reapply title/description/og/twitter |
| `packages/twenty-front/public/manifest.json` | Names/colors | Take upstream, reapply |
| `.../navigation-drawer/constants/DefaultWorkspaceLogo.ts` | Local brand icon | Reapply |
| `packages/twenty-emails/src/constants/DefaultWorkspaceLogo.ts` | Brand icon URL | Reapply |
| `packages/twenty-front/src/modules/navigation/components/SettingsNavigationDrawerContent.tsx` | `<BrandSourceAttribution />` | Reapply |
| `packages/twenty-front/src/pages/auth/SignInUp.tsx` | "Welcome to {brandName}" | Reapply |
| `packages/twenty-front/src/pages/not-found/NotFound.tsx` | "Page Not Found \| {brandName}" | Reapply |
| `packages/twenty-front/public/images/integrations/twenty-logo.svg` | Brand icon, same path | Regenerate from `brand-icon-source.png` |
| `packages/twenty-front/src/utils/title-utils.ts`, `.../getTimelineActivityAuthorFullName.ts`, `ConnectedAgentConnectionSnippet.tsx`, `SettingsCompositeFieldTypeConfigs.ts`, `McpSetup.ts`, `mcpSetup.ts` | Product name or neutral examples | Reapply |
| `.../buildMcpSetupCategories.tsx` | Twenty's ChatGPT app card removed | Remove it again |
| `.../onboarding/import-contacts/OnboardingTrustBadges.tsx`, `public/images/onboarding/trust-badges/*`, `pages/onboarding/ImportContacts.tsx` | SOC2 and GDPR badges removed: Twenty's certifications | Remove them again |
| `packages/twenty-front/src/modules/auth/sign-in-up/components/{FooterNote,SignInUpStandardContent}.tsx` | Privacy link only: no Twenty, terms or DPA | Reapply |
| `.../settings/hooks/useSettingsNavigationItems.tsx`, `.../app/components/SettingsRoutes.tsx`, `.../app/routing/utils/createWorkspaceRouteObjects.tsx` | Community and Documentation hidden; `/dpa` and `/settings/legal/dpa` routes removed | Remove them again |
| `packages/twenty-shared/src/constants/DocumentationBaseUrl.ts`, `.../support/utils/getDocumentationUrl.ts`, `WorkflowEditActionFormBuilder.tsx` | Help links go to the company site or disappear | Reapply |
| `packages/twenty-emails/src/common-style.ts` and templates that use its accent | `#9333EA`, Outfit | Reapply |
| `packages/twenty-emails/src/components/{Logo,Footer,WhatIsTwenty,BaseHead}.tsx`, emails with the product name | Brand chrome, `{brandName}` from `BRAND_EMAIL_IDENTITY` | Reapply |
| `packages/twenty-emails/src/index.ts` | Exports `BRAND_EMAIL_IDENTITY` | Reapply |
| `packages/twenty-server/.../sign-in-up.service.ts` | Stops recording the click-through DPA naming Twenty.com PBC. Table and entity stay | Remove the block again |
| `packages/twenty-server/.../{two-factor-authentication.service,workspace-invitation.service,approved-access-domain.service,oauth-propagator.controller,application-version-validation.service}.ts` | Product name in 2FA issuer, sender and messages | Reapply |
| `packages/twenty-server/.../ai/**/{chat-system-prompts,workspace-setup-system-prompt,agent-run-base-system-prompt,workflow-base-system-prompt}*` | Identity sentence only | Reapply |
| `packages/twenty-server/.../create-standard-flat-agent-metadata.util.ts`, `prefill-workflows.util.ts`, `compute-my-first-dashboard-widgets.util.ts` | Helper agent and seeds, new workspaces only | Reapply |
| `packages/twenty-server/.../api/mcp/**`, `build-mcp-server-card.util.ts`, `base-schema.utils.ts` | Displayed text and instructions only. Tool names, schemas, `search_help_center` and `com.twenty/twenty` stay | Reapply |
| `packages/twenty-server/.../email-templates-rendering.spec.ts` | Branding test | Reapply test |
| `packages/twenty-{front,emails}/src/locales/*.po`, server `locales/*.po`, `generated/*` | Rewritten msgstr | See "Catalogs" below |

## Catalogs

`packages/twenty-front/scripts/brand/apply-brand-catalogs.mjs` rewrites `msgstr`, never `msgid`, in the front,
email and server catalogs, then runs `lingui compile`. Exceptions and `pt-BR`/`pt-PT` strings for `{brandName}`
messages live in `brand-catalog-rules.json`. It is idempotent.

Compiled catalogs use `msgstr` over `msgid` at runtime, including for the `en` source locale; locales without
an entry fall back to the English `msgstr`.

After an upstream merge: take upstream catalogs, run `lingui:extract` where messages changed, restore the locales
the fork does not translate (`git status --porcelain packages/twenty-{front,emails}/src/locales | awk '{print $2}' | grep -E '\.po$' | grep -vE '/(en|pt-BR|pt-PT)\.po$' | xargs git checkout --`),
then run the script.

Twenty stays in two messages on purpose: `Built on Twenty (open source)` (AGPL section 13) and the DPA line naming
who signs (the screen is blocked).

## Guards

- `packages/twenty-front/src/modules/brand/__tests__/brandCatalogs.test.ts` fails if "Twenty" or `twenty.com` appears
  in a `msgstr` or compiled catalog outside the exceptions, and pins the runtime `msgstr` behaviour.
- `FooterNote.test.tsx` and `createWorkspaceRouteObjects.test.tsx` fail if legal links or DPA routes return.
- `sign-in-up-dpa-guard.spec.ts` fails if sign-up records the DPA again.

- `packages/twenty-front/src/modules/brand/__tests__/colaboratorioTheme.test.ts` fails if
  upstream renames a theme variable the brand overrides, or if contrast drops below WCAG AA.
- `email-templates-rendering.spec.ts` fails if upstream email chrome reappears.

## Syncing upstream

```bash
git fetch upstream
git checkout dev
git merge upstream/main
# resolve conflicts with the table above
npx jest packages/twenty-front/src/modules/brand --config=packages/twenty-front/jest.config.mjs
```
