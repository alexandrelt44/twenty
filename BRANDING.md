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
| Interface font | Inter (upstream default, not overridden). Outfit only inside the logo artwork |
| Code font | JetBrains Mono, monospace |
| Email accent | `#BE185D` |
| Email font | Inter, Arial, sans-serif |
| Accent light | 1-8 `#FDF2F8` to `#F9A8D4`, 9 `#BE185D`, 10 `#9D174D`, 11 `#9D174D`, 12 `#500724` |
| Accent dark | 1-8 `#191114` to `#B0436E`, 9 `#BE185D`, 10 `#DB2777`, 11 `#F9A8D4`, 12 `#FCE7F3` |
| `theme-color`, manifest `theme_color` | `#1C1A17` |
| Manifest `background_color` | `#F5F2EA` |
| Icon | `packages/twenty-front/scripts/brand/brand-icon-source.png`, 512x512, the ColabCRM `favicon-512.png` from the brand kit |

The full 12-step scale lives in `packages/twenty-front/src/modules/brand/colaboratorio-theme.css`.

## ColabOS design system (PRD-974)

The same stylesheet applies the ColabOS design system (`docs/design-system/` in `alexandrelt44/colabtools`:
`tokens.css` and `componentes.md`) in light mode. Dark mode keeps Twenty's neutrals until the ColabOS has a dark
content mode.

| Item | Value |
|---|---|
| Neutrals | Twenty's gray scale re-mapped to the "areia" scale: `#FFFFFF`, `#FBFAF6`, `#F5F2EA` ... `#5E5A52`, `#1C1A17` |
| Text | Primary `#1C1A17`, secondary `#5E5A52`, tertiary (placeholders, empty values) `#8A8478` |
| Page and surfaces | Main page cream `#F5F2EA`; tables, cards, menus, modals and fields white; table header `#FBF9F4` |
| Borders | `#E2DCCE` (medium), `#EFEAE0` (light), `#D6CFC0` (strong, outline buttons) |
| Hover and pressed | `#ECE7DB`, `#E2DCCE` |
| Shadows and overlays | From `rgb(28 26 23)`, never pure black |
| Radii | 6 px (sm), 10 px (md: buttons, menus, fields), 16 px (lg), 20 px (xl); plain rounded corners, no squircles |
| Sidebar | `#1C1A17`, items `#E7E2D8`, labels `#9A9387`, hover `#26231F`; current item a cream `#F5F2EA` chip with `#1C1A17` text at 600; monochrome icons; workspace switcher in a `#26231F` box with a `#3A3631` border |
| Tabs | Current tab underlined 3 px in `#BE185D` |
| Primary action | `#BE185D` (the KATIA purple stays out of the CRM) |

The layer only re-maps theme variables, plus a few rules on stable hooks. If an upstream merge drops one of
these hooks, the rule stops matching and that part falls back to Twenty's look; nothing breaks:

| Hook | Used for |
|---|---|
| `[data-click-outside-id='navigation-drawer']` (`NAVIGATION_DRAWER_CLICK_OUTSIDE_ID`) | Dark sidebar, re-mapped roles inside it |
| `[aria-current='page']`, `button[aria-current='true']` inside the drawer | Current item and current mode chip |
| `.navigation-drawer-item` | Monochrome icons in the sidebar |
| `[data-testid='workspace-dropdown']` | Workspace switcher box |
| `[data-page-surface='main'] > div > div` (`PageCardLayout`'s card) | Cream page; white fields and outline buttons inside it |
| `.header-cell` | Table header fill and label color |
| `button[data-variant='outline']` | Outline button border |
| `[class*='_tabButton_'][data-active]`, `[class*='_tabContainer_'][data-active]` | Pink tab underline |

Left as Twenty draws it, because matching the ColabOS would mean changing upstream components or structure:
table density (32 px rows, `RECORD_TABLE_ROW_HEIGHT`, tied to virtualization) and 13 px text, 28 px sidebar items
instead of 44 px, Tabler icons at 16 px instead of Lucide at 18 px, the account box at the foot of the sidebar,
the page title in Outfit 34 px, the mobile bottom bar, and tag colors (chosen per option in the CRM).

Twenty resolves part of the theme in JS at startup (`getComputedStyle(document.documentElement)`), for instance
the record table cells. Those read the root values only, so the sidebar and page scoping above applies to
components that use `themeCssVariables`, and the root values must stay right on their own.

Source of the values: the Colab brand kit, `docs/brand/` in `alexandrelt44/colabtools` (`tokens.css`,
`logos/colabcrm/`). The accent is the Tailwind pink scale the kit uses: `#BE185D` for primary actions,
`#9D174D` for hover and links on light backgrounds, `#F9A8D4` for links on dark backgrounds.

## Fork-only files (never conflict)

- `packages/twenty-front/src/modules/brand/**` — theme CSS, identity constant, attribution
- `packages/twenty-front/scripts/brand/**` — icon source + generator, catalog script `apply-brand-catalogs.mjs`, rules `brand-catalog-rules.json`
- `packages/twenty-emails/src/constants/BrandEmailIdentity.ts`
- `.github/workflows/fork-build-image.yaml` — GHCR build workflow
- `BRANDING.md`

## Upstream files touched (may conflict on merge)

| File | Change | On conflict |
|---|---|---|
| `packages/twenty-front/src/index.tsx` | `@fontsource/jetbrains-mono` import (alphabetical) + brand CSS (last) | Take upstream, re-add the import alphabetically, then add brand CSS as final import |
| `packages/twenty-front/package.json`, `yarn.lock` | `@fontsource/jetbrains-mono` | Take upstream, `yarn workspace twenty-front add @fontsource/jetbrains-mono@^5` |
| `packages/twenty-front/public/images/icons/**` | Regenerated brand icons | Take upstream, run `packages/twenty-front/scripts/brand/generate-brand-icons.sh` |
| `packages/twenty-front/index.html` | Title/meta, `theme-color` | Take upstream, reapply title/description/og/twitter/theme-color |
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
| `packages/twenty-shared/src/constants/DocumentationBaseUrl.ts`, `.../support/utils/getDocumentationUrl.ts`, `WorkflowEditActionFormBuilder.tsx`, `packages/twenty-server/.../build-api-catalog.util.ts` | Help links go to the company site or disappear | Reapply |
| `packages/twenty-emails/src/common-style.ts` and templates that use its accent | `#BE185D`, Inter with Arial fallback | Reapply |
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
  upstream renames a theme variable the brand overrides (root or sidebar), or if contrast drops below WCAG AA:
  accent on white, text on the light surfaces, and text in the sidebar and its current item.
- `email-templates-rendering.spec.ts` fails if upstream email chrome reappears.

## Syncing upstream

```bash
git fetch upstream
git checkout dev
git merge upstream/main
# resolve conflicts with the table above
npx jest packages/twenty-front/src/modules/brand --config=packages/twenty-front/jest.config.mjs
```
