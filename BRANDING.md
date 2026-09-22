# colaborato.rio branding layer

This fork (`alexandrelt44/twenty`) ships the colaborato.rio CRM. Branding is a thin
layer over upstream Twenty. Spec: `docs/superpowers/specs/2026-09-16-colaboratorio-branding-design.md`.

## Fork-only files (never conflict)

- `packages/twenty-front/src/modules/brand/**` — theme CSS, identity constant, attribution
- `packages/twenty-front/scripts/brand/**` — icon source + generator
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
| `packages/twenty-front/src/pages/auth/SignInUp.tsx` | "Welcome to colaborato.rio" | Reapply |
| `packages/twenty-front/src/pages/not-found/NotFound.tsx` | "Page Not Found \| colaborato.rio" | Reapply |
| `packages/twenty-emails/src/components/{Logo,Footer,WhatIsTwenty,BaseHead}.tsx` | Brand chrome | Reapply |
| `packages/twenty-server/.../email-templates-rendering.spec.ts` | Branding test | Reapply test |
| `packages/twenty-{front,emails}/src/locales/{en,pt-BR,pt-PT}.po` + `generated/*` | Brand strings (en/pt-BR/pt-PT) | Take upstream, run `lingui:extract`, retranslate brand entries, `lingui:compile`, then restore only the locales the fork does not translate (`git checkout -- $(git status --porcelain packages/twenty-{front,emails}/src/locales \| awk '{print $2}' \| grep -vE '/(en\|pt-BR\|pt-PT)\.(po\|ts)$')`) — a bare `git checkout -- packages/twenty-{front,emails}/src/locales` would also revert the brand entries and freshly compiled catalogs in en/pt-BR/pt-PT |

## Guards

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
