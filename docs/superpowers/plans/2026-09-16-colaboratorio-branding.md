# Branding colaborato.rio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a light colaborato.rio identity (purple accent, Outfit font, brand icon, names, emails, AGPL attribution) to the Twenty fork and ship it as a GHCR image deployed on the openclaw VPS.

**Architecture:** A fork-only brand layer in `packages/twenty-front/src/modules/brand/` overrides twenty-ui CSS custom properties (`--t-accent-*`, `--t-color-blue*`, fonts) by being imported after the upstream theme CSS. Everything else is a handful of one-line edits in upstream files (icons regenerated in place with the same file names, 2 UI strings, email components, a Settings attribution line), inventoried in `BRANDING.md` so upstream merges stay cheap. A fork-only GitHub Actions workflow builds the unmodified upstream Dockerfile into `ghcr.io/alexandrelt44/colaboratorio-crm`.

**Tech Stack:** React 18 + Linaria + Lingui (twenty-front), react-email + Lingui (twenty-emails), Jest, CSS custom properties, `@fontsource`, macOS `sips`, GitHub Actions + docker/build-push-action, Docker Compose on the VPS.

**Spec:** `docs/superpowers/specs/2026-09-16-colaboratorio-branding-design.md`

## Global Constraints

- Brand name is always lowercase: `colaborato.rio`.
- Brand website: `https://colaborato.rio`. Fork source: `https://github.com/alexandrelt44/twenty`. Instance URL: `https://crm.colaborato.rio`.
- Brand icon source: `~/Projetos/colaboratorio/landing-page/dist/assets/favicon.png` (512×512). Use as-is; never redraw brand assets. The wordmark logo is NOT used in the app.
- Default color scheme stays `System` — do not change theme defaults.
- Do not change grays, surfaces, borders, radii, spacing, layout or navigation.
- Do not edit `LICENSE` or any file marked `/* @license Enterprise */`.
- Keep "Twenty" in technical strings (MCP instructions, billing, enterprise, "Twenty fields") and in `FooterNote.tsx`.
- Lingui catalogs: commit changes only for `en`, `pt-BR`, `pt-PT` (both `.po` and `generated/*.ts`); restore every other locale file.
- Upstream code style: named exports, types over interfaces, `//` comments only for WHY, no abbreviations, `isDefined` from `twenty-shared/utils`.
- Commit messages: conventional, **no AI attribution trailers** (CI rejects them).
- All work on branch `dev`, except the deploy branch `release` (Task 7).
- WCAG AA: text contrast ≥ 4.5:1 for every brand text/background pair tested.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `packages/twenty-front/src/modules/brand/colaboratorio-theme.css` | Create | Token overrides for `.light` / `.dark` + body font |
| `packages/twenty-front/src/modules/brand/__tests__/colaboratorioTheme.test.ts` | Create | Guard: overridden vars exist upstream; WCAG contrast |
| `packages/twenty-front/src/index.tsx` | Modify | Import brand fonts and brand CSS last |
| `packages/twenty-front/package.json` | Modify | Add `@fontsource/outfit`, `@fontsource/jetbrains-mono` |
| `packages/twenty-front/scripts/brand/brand-icon-source.png` | Create | Copy of brand icon |
| `packages/twenty-front/scripts/brand/generate-brand-icons.sh` | Create | Regenerate all PNG icons keeping names/dimensions |
| `packages/twenty-front/public/images/icons/**.png` | Regenerate | App/PWA icons (112 files) |
| `packages/twenty-front/src/modules/ui/navigation/navigation-drawer/constants/DefaultWorkspaceLogo.ts` | Modify | Local brand icon |
| `packages/twenty-front/index.html` | Modify | Title/meta |
| `packages/twenty-front/public/manifest.json` | Modify | PWA names/colors |
| `packages/twenty-front/src/modules/brand/constants/BrandIdentity.ts` | Create | Brand name/URLs for front |
| `packages/twenty-front/src/modules/brand/components/BrandSourceAttribution.tsx` | Create | AGPL attribution line |
| `packages/twenty-front/src/modules/brand/components/__tests__/BrandSourceAttribution.test.tsx` | Create | Component test |
| `packages/twenty-front/src/modules/navigation/components/SettingsNavigationDrawerContent.tsx` | Modify | Render attribution under Advanced switch |
| `packages/twenty-front/src/pages/auth/SignInUp.tsx` | Modify | "Welcome to colaborato.rio" |
| `packages/twenty-front/src/pages/not-found/NotFound.tsx` | Modify | "Page Not Found \| colaborato.rio" |
| `packages/twenty-front/src/locales/{en,pt-BR,pt-PT}.po` + `generated/{en,pt-BR,pt-PT}.ts` | Modify | Catalog entries |
| `packages/twenty-emails/src/constants/BrandEmailIdentity.ts` | Create | Brand name/URLs for emails |
| `packages/twenty-emails/src/constants/DefaultWorkspaceLogo.ts` | Modify | Brand icon URL |
| `packages/twenty-emails/src/components/{Logo,Footer,WhatIsTwenty,BaseHead}.tsx` | Modify | Branded email chrome |
| `packages/twenty-emails/src/locales/{en,pt-BR,pt-PT}.po` + `generated/*` | Modify | Catalog entries |
| `packages/twenty-server/src/engine/core-modules/email/__tests__/email-templates-rendering.spec.ts` | Modify | Assert branded email output |
| `BRANDING.md` | Create | Inventory of upstream touch points + merge guide |
| `.github/workflows/fork-build-image.yaml` | Create | GHCR image build |

---

### Task 1: Brand theme layer (tokens + fonts)

**Files:**
- Create: `packages/twenty-front/src/modules/brand/colaboratorio-theme.css`
- Create: `packages/twenty-front/src/modules/brand/__tests__/colaboratorioTheme.test.ts`
- Modify: `packages/twenty-front/src/index.tsx:6-16`
- Modify: `packages/twenty-front/package.json` (dependencies)

**Interfaces:**
- Consumes: upstream `packages/twenty-ui/src/theme-constants/theme-light.css` / `theme-dark.css` (generated; define `--t-*` vars inside `.light {}` / `.dark {}`).
- Produces: CSS file path `packages/twenty-front/src/modules/brand/colaboratorio-theme.css` (Task 6 lists it in `BRANDING.md`).

- [ ] **Step 1: Write the failing test**

Create `packages/twenty-front/src/modules/brand/__tests__/colaboratorioTheme.test.ts`:

```ts
import { readFileSync } from 'fs';
import { resolve } from 'path';

const readRelativeFile = (relativePath: string) =>
  readFileSync(resolve(__dirname, relativePath), 'utf8');

const BRAND_CSS_PATH = '../colaboratorio-theme.css';
const UPSTREAM_THEME_PATHS = {
  light: '../../../../../twenty-ui/src/theme-constants/theme-light.css',
  dark: '../../../../../twenty-ui/src/theme-constants/theme-dark.css',
};

type ColorSchemeClass = keyof typeof UPSTREAM_THEME_PATHS;

const getSelectorBlocks = (css: string, colorSchemeClass: ColorSchemeClass) =>
  [...css.matchAll(new RegExp(`\\.${colorSchemeClass}\\s*\\{([^}]*)\\}`, 'g'))]
    .map((match) => match[1])
    .join('\n');

const getDeclaredVariableNames = (block: string) =>
  [...block.matchAll(/(--t-[a-z0-9-]+)\s*:/g)].map((match) => match[1]);

const getHexValue = (block: string, variableName: string) => {
  const match = block.match(
    new RegExp(`${variableName}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`),
  );

  if (match === null) {
    throw new Error(`${variableName} is not declared as a hex color`);
  }

  return match[1];
};

const getRelativeLuminance = (hexColor: string) => {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(hexColor.slice(offset, offset + 2), 16) / 255;

    return channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const getContrastRatio = (foreground: string, background: string) => {
  const [lighter, darker] = [
    getRelativeLuminance(foreground),
    getRelativeLuminance(background),
  ].sort((first, second) => second - first);

  return (lighter + 0.05) / (darker + 0.05);
};

describe('colaboratorio theme', () => {
  const brandCss = readRelativeFile(BRAND_CSS_PATH);

  it.each(['light', 'dark'] as const)(
    'should only override variables that exist in the upstream %s theme',
    (colorSchemeClass) => {
      const upstreamVariableNames = new Set(
        getDeclaredVariableNames(
          getSelectorBlocks(
            readRelativeFile(UPSTREAM_THEME_PATHS[colorSchemeClass]),
            colorSchemeClass,
          ),
        ),
      );
      const brandVariableNames = getDeclaredVariableNames(
        getSelectorBlocks(brandCss, colorSchemeClass),
      );

      expect(brandVariableNames.length).toBeGreaterThan(0);
      expect(
        brandVariableNames.filter(
          (variableName) => !upstreamVariableNames.has(variableName),
        ),
      ).toEqual([]);
    },
  );

  it.each([
    { colorSchemeClass: 'light', background: '#ffffff' },
    { colorSchemeClass: 'dark', background: '#171717' },
  ] as const)(
    'should keep brand colors WCAG AA readable in $colorSchemeClass mode',
    ({ colorSchemeClass, background }) => {
      const block = getSelectorBlocks(brandCss, colorSchemeClass);

      expect(
        getContrastRatio('#ffffff', getHexValue(block, '--t-color-blue')),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(getHexValue(block, '--t-accent-accent11'), background),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest packages/twenty-front/src/modules/brand/__tests__/colaboratorioTheme.test.ts --config=packages/twenty-front/jest.config.mjs`
Expected: FAIL with `ENOENT: no such file or directory` for `colaboratorio-theme.css`.

- [ ] **Step 3: Create the brand CSS**

Create `packages/twenty-front/src/modules/brand/colaboratorio-theme.css`. Scales are Radix Purple, with light steps 9–11 darkened and dark step 11 set to the brand lavender `#D8B4FE`. Aliases mirror the upstream mapping (primary/secondary → 5, tertiary → 3, quaternary → 2, accent3570/accent4060 → 8):

```css
/* colaborato.rio brand layer. Imported after twenty-ui theme CSS so these
   declarations win with equal specificity. Inventory: BRANDING.md. */

.light {
  --t-accent-accent1: #fefcfe;
  --t-accent-accent2: #fbf7fe;
  --t-accent-accent3: #f7edfe;
  --t-accent-accent4: #f2e2fc;
  --t-accent-accent5: #ead5f9;
  --t-accent-accent6: #e0c4f4;
  --t-accent-accent7: #d1afec;
  --t-accent-accent8: #be93e4;
  --t-accent-accent9: #9333ea;
  --t-accent-accent10: #7e22ce;
  --t-accent-accent11: #7e22ce;
  --t-accent-accent12: #402060;
  --t-accent-primary: var(--t-accent-accent5);
  --t-accent-secondary: var(--t-accent-accent5);
  --t-accent-tertiary: var(--t-accent-accent3);
  --t-accent-quaternary: var(--t-accent-accent2);
  --t-accent-accent3570: var(--t-accent-accent8);
  --t-accent-accent4060: var(--t-accent-accent8);

  /* Primary buttons and links read the blue scale, not accent. User-picked
     "blue" tags use --t-tag-*-blue and stay blue. */
  --t-color-blue: #9333ea;
  --t-color-blue1: #fefcfe;
  --t-color-blue2: #fbf7fe;
  --t-color-blue3: #f7edfe;
  --t-color-blue4: #f2e2fc;
  --t-color-blue5: #ead5f9;
  --t-color-blue6: #e0c4f4;
  --t-color-blue7: #d1afec;
  --t-color-blue8: #be93e4;
  --t-color-blue9: #9333ea;
  --t-color-blue10: #7e22ce;
  --t-color-blue11: #7e22ce;
  --t-color-blue12: #402060;

  --t-font-family: Outfit, sans-serif;
  --t-code-font-family: 'JetBrains Mono', monospace;
}

.dark {
  --t-accent-accent1: #18111b;
  --t-accent-accent2: #1e1523;
  --t-accent-accent3: #301c3b;
  --t-accent-accent4: #3d224e;
  --t-accent-accent5: #48295c;
  --t-accent-accent6: #54346b;
  --t-accent-accent7: #664282;
  --t-accent-accent8: #8457aa;
  --t-accent-accent9: #8e4ec6;
  --t-accent-accent10: #9a5cd0;
  --t-accent-accent11: #d8b4fe;
  --t-accent-accent12: #ecd9fa;
  --t-accent-primary: var(--t-accent-accent5);
  --t-accent-secondary: var(--t-accent-accent5);
  --t-accent-tertiary: var(--t-accent-accent3);
  --t-accent-quaternary: var(--t-accent-accent2);
  --t-accent-accent3570: var(--t-accent-accent8);
  --t-accent-accent4060: var(--t-accent-accent8);

  --t-color-blue: #8e4ec6;
  --t-color-blue1: #18111b;
  --t-color-blue2: #1e1523;
  --t-color-blue3: #301c3b;
  --t-color-blue4: #3d224e;
  --t-color-blue5: #48295c;
  --t-color-blue6: #54346b;
  --t-color-blue7: #664282;
  --t-color-blue8: #8457aa;
  --t-color-blue9: #8e4ec6;
  --t-color-blue10: #9a5cd0;
  --t-color-blue11: #d8b4fe;
  --t-color-blue12: #ecd9fa;

  --t-font-family: Outfit, sans-serif;
  --t-code-font-family: 'JetBrains Mono', monospace;
}

/* index.css hardcodes Inter on body. */
body {
  font-family: 'Outfit', sans-serif;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest packages/twenty-front/src/modules/brand/__tests__/colaboratorioTheme.test.ts --config=packages/twenty-front/jest.config.mjs`
Expected: PASS (4 tests). If the "only override variables that exist" test fails, a name above is wrong — compare against `grep -o -- '--t-[a-z0-9-]*' packages/twenty-ui/src/theme-constants/theme-light.css`.

- [ ] **Step 5: Add font packages**

Run: `yarn workspace twenty-front add @fontsource/outfit@^5 @fontsource/jetbrains-mono@^5`
Expected: `package.json` gains both deps; `yarn.lock` updated.

- [ ] **Step 6: Wire fonts and CSS into the entrypoint**

In `packages/twenty-front/src/index.tsx`, keep the existing imports and add the brand ones. The brand CSS must be the **last** CSS import:

```tsx
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import 'react-loading-skeleton/dist/skeleton.css';
import 'twenty-ui/style.css';
import 'twenty-ui/theme-light.css';
import 'twenty-ui/theme-dark.css';
import './index.css';
import './modules/brand/colaboratorio-theme.css';
```

- [ ] **Step 7: Typecheck and lint**

Run: `cd packages/twenty-front && npx tsgo -p tsconfig.json --noEmit; cd ../..`
Expected: exit 0.
Run: `npx oxlint packages/twenty-front/src/modules/brand packages/twenty-front/src/index.tsx && npx oxfmt --check packages/twenty-front/src/modules/brand packages/twenty-front/src/index.tsx`
Expected: no errors (run `npx oxfmt` without `--check` to fix formatting).

- [ ] **Step 8: Commit**

```bash
git add packages/twenty-front/src/modules/brand packages/twenty-front/src/index.tsx packages/twenty-front/package.json yarn.lock
git commit -m "feat(brand): add colaborato.rio theme layer (purple accent, Outfit)"
```

---

### Task 2: Brand icon, default logos, HTML and manifest

**Files:**
- Create: `packages/twenty-front/scripts/brand/brand-icon-source.png`
- Create: `packages/twenty-front/scripts/brand/generate-brand-icons.sh`
- Regenerate: `packages/twenty-front/public/images/icons/**/*.png`
- Modify: `packages/twenty-front/src/modules/ui/navigation/navigation-drawer/constants/DefaultWorkspaceLogo.ts`
- Modify: `packages/twenty-emails/src/constants/DefaultWorkspaceLogo.ts`
- Modify: `packages/twenty-front/index.html:15-31`
- Modify: `packages/twenty-front/public/manifest.json:2-7`

**Interfaces:**
- Produces: icon URLs used later — `${window.location.origin}/images/icons/android/android-launchericon-192-192.png` (front default logo) and `https://crm.colaborato.rio/images/icons/windows11/Square150x150Logo.scale-100.png` (email logo, Task 4).

- [ ] **Step 1: Copy the brand icon**

```bash
mkdir -p packages/twenty-front/scripts/brand
cp ~/Projetos/colaboratorio/landing-page/dist/assets/favicon.png packages/twenty-front/scripts/brand/brand-icon-source.png
sips -g pixelWidth -g pixelHeight packages/twenty-front/scripts/brand/brand-icon-source.png
```
Expected: `pixelWidth: 512`, `pixelHeight: 512`.

- [ ] **Step 2: Record current icon dimensions (baseline for verification)**

```bash
find packages/twenty-front/public/images/icons -name '*.png' | sort | while read -r icon; do
  echo "$icon $(sips -g pixelWidth "$icon" | awk '/pixelWidth/{print $2}')x$(sips -g pixelHeight "$icon" | awk '/pixelHeight/{print $2}')"
done > "$TMPDIR/brand-icons-before.txt"
wc -l < "$TMPDIR/brand-icons-before.txt"
```
Expected: `112`.

- [ ] **Step 3: Write the generator script**

Create `packages/twenty-front/scripts/brand/generate-brand-icons.sh`:

```bash
#!/usr/bin/env bash
# Regenerates every PNG under public/images/icons from the colaborato.rio icon,
# keeping each file's name and pixel size so index.html and manifest.json never
# need to change (keeps upstream merges conflict-free). macOS only: uses sips.
set -euo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ICON="$SCRIPT_DIRECTORY/brand-icon-source.png"
ICONS_DIRECTORY="$SCRIPT_DIRECTORY/../../public/images/icons"
# Non-square tiles (splash screens, wide tiles) are padded with the brand background.
PAD_COLOR="0A0A0F"
TEMPORARY_ICON="$(mktemp -t brand-icon).png"

regenerated_count=0

while IFS= read -r -d '' icon_path; do
  width="$(sips -g pixelWidth "$icon_path" | awk '/pixelWidth/ {print $2}')"
  height="$(sips -g pixelHeight "$icon_path" | awk '/pixelHeight/ {print $2}')"
  square_size=$(( width < height ? width : height ))

  sips -s format png -z "$square_size" "$square_size" "$SOURCE_ICON" --out "$TEMPORARY_ICON" > /dev/null

  if [[ "$width" -eq "$height" ]]; then
    cp "$TEMPORARY_ICON" "$icon_path"
  else
    sips -p "$height" "$width" --padColor "$PAD_COLOR" "$TEMPORARY_ICON" --out "$icon_path" > /dev/null
  fi

  regenerated_count=$(( regenerated_count + 1 ))
done < <(find "$ICONS_DIRECTORY" -name '*.png' -print0)

rm -f "$TEMPORARY_ICON"
echo "Regenerated $regenerated_count icons"
```

- [ ] **Step 4: Run the script**

```bash
chmod +x packages/twenty-front/scripts/brand/generate-brand-icons.sh
packages/twenty-front/scripts/brand/generate-brand-icons.sh
```
Expected: `Regenerated 112 icons`.

- [ ] **Step 5: Verify names and dimensions are unchanged**

```bash
find packages/twenty-front/public/images/icons -name '*.png' | sort | while read -r icon; do
  echo "$icon $(sips -g pixelWidth "$icon" | awk '/pixelWidth/{print $2}')x$(sips -g pixelHeight "$icon" | awk '/pixelHeight/{print $2}')"
done > "$TMPDIR/brand-icons-after.txt"
diff "$TMPDIR/brand-icons-before.txt" "$TMPDIR/brand-icons-after.txt" && echo "dimensions unchanged"
```
Expected: `dimensions unchanged`. Then open 2 samples to eyeball them with the Read tool: `public/images/icons/android/android-launchericon-192-192.png` and `public/images/icons/windows11/Wide310x150Logo.scale-100.png` (the icon must be centered on a dark background, not stretched).

- [ ] **Step 6: Point default workspace logos at the brand icon**

`packages/twenty-front/src/modules/ui/navigation/navigation-drawer/constants/DefaultWorkspaceLogo.ts`:

```ts
// Must be absolute: getImageAbsoluteURI rewrites relative paths to the server's
// /files endpoint. Same origin trick as auth/components/Logo.tsx.
export const DEFAULT_WORKSPACE_LOGO = `${window.location.origin}/images/icons/android/android-launchericon-192-192.png`;
```

`packages/twenty-emails/src/constants/DefaultWorkspaceLogo.ts` (emails need an absolute URL):

```ts
export const DEFAULT_WORKSPACE_LOGO =
  'https://crm.colaborato.rio/images/icons/android/android-launchericon-192-192.png';
```

- [ ] **Step 7: Update `index.html` metadata**

In `packages/twenty-front/index.html`, replace lines 15–31 (from `<meta name="theme-color"` to `<title>Twenty</title>`) with:

```html
    <meta name="theme-color" content="#0A0A0F" />
    <meta name="description" content="O CRM da colaborato.rio" />
    <meta
      property="og:image"
      content="https://crm.colaborato.rio/images/icons/ios/1024.png"
    />
    <meta property="og:description" content="O CRM da colaborato.rio" />
    <meta property="og:title" content="colaborato.rio" />
    <meta name="twitter:card" content="summary" />
    <meta
      name="twitter:image"
      content="https://crm.colaborato.rio/images/icons/ios/1024.png"
    />

    <meta name="twitter:description" content="O CRM da colaborato.rio" />
    <meta name="twitter:title" content="colaborato.rio" />
    <title>colaborato.rio</title>
```

- [ ] **Step 8: Update `manifest.json`**

In `packages/twenty-front/public/manifest.json` set:

```json
  "short_name": "colaborato.rio",
  "name": "colaborato.rio",
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#0A0A0F",
  "background_color": "#0A0A0F",
```

Verify: `node -e "JSON.parse(require('fs').readFileSync('packages/twenty-front/public/manifest.json','utf8')); console.log('valid')"` → `valid`.

- [ ] **Step 9: Typecheck affected packages**

Run: `cd packages/twenty-front && npx tsgo -p tsconfig.json --noEmit; cd ../twenty-emails && npx tsgo -p tsconfig.json --noEmit; cd ../..`
Expected: exit 0 for both (if `twenty-emails` has no `tsconfig.json` at root, run `npx nx typecheck twenty-emails`).

- [ ] **Step 10: Commit**

```bash
git add packages/twenty-front/scripts/brand packages/twenty-front/public/images/icons packages/twenty-front/public/manifest.json packages/twenty-front/index.html packages/twenty-front/src/modules/ui/navigation/navigation-drawer/constants/DefaultWorkspaceLogo.ts packages/twenty-emails/src/constants/DefaultWorkspaceLogo.ts
git commit -m "feat(brand): use colaborato.rio icon, title and manifest"
```

---

### Task 3: AGPL source attribution in Settings

**Files:**
- Create: `packages/twenty-front/src/modules/brand/constants/BrandIdentity.ts`
- Create: `packages/twenty-front/src/modules/brand/components/BrandSourceAttribution.tsx`
- Create: `packages/twenty-front/src/modules/brand/components/__tests__/BrandSourceAttribution.test.tsx`
- Modify: `packages/twenty-front/src/modules/navigation/components/SettingsNavigationDrawerContent.tsx`

**Interfaces:**
- Produces: `BRAND_IDENTITY: { name: string; websiteUrl: string; sourceCodeUrl: string }` from `@/brand/constants/BrandIdentity`; `BrandSourceAttribution` (no props) from `@/brand/components/BrandSourceAttribution`. New Lingui messages `Built on Twenty (open source)` and `Source code` (extracted in Task 4).

- [ ] **Step 1: Write the failing test**

Create `packages/twenty-front/src/modules/brand/components/__tests__/BrandSourceAttribution.test.tsx`:

```tsx
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen } from '@testing-library/react';

import { BrandSourceAttribution } from '@/brand/components/BrandSourceAttribution';

describe('BrandSourceAttribution', () => {
  it('should credit Twenty and link to the fork source code', () => {
    render(
      <I18nProvider i18n={i18n}>
        <BrandSourceAttribution />
      </I18nProvider>,
    );

    expect(screen.getByText('Built on Twenty (open source)')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Source code' })).toHaveAttribute(
      'href',
      'https://github.com/alexandrelt44/twenty',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest packages/twenty-front/src/modules/brand/components/__tests__/BrandSourceAttribution.test.tsx --config=packages/twenty-front/jest.config.mjs`
Expected: FAIL with `Cannot find module '@/brand/components/BrandSourceAttribution'`.

- [ ] **Step 3: Implement constant and component**

`packages/twenty-front/src/modules/brand/constants/BrandIdentity.ts`:

```ts
export const BRAND_IDENTITY = {
  name: 'colaborato.rio',
  websiteUrl: 'https://colaborato.rio',
  sourceCodeUrl: 'https://github.com/alexandrelt44/twenty',
};
```

`packages/twenty-front/src/modules/brand/components/BrandSourceAttribution.tsx`:

```tsx
import { styled } from '@linaria/react';
import { Trans } from '@lingui/react/macro';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { BRAND_IDENTITY } from '@/brand/constants/BrandIdentity';

// AGPLv3 §13: users interacting over a network must be offered the source.
const StyledAttribution = styled.div`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[1]};

  a {
    color: inherit;
  }
`;

export const BrandSourceAttribution = () => {
  return (
    <StyledAttribution>
      <Trans>Built on Twenty (open source)</Trans> ·{' '}
      <a
        href={BRAND_IDENTITY.sourceCodeUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Trans>Source code</Trans>
      </a>
    </StyledAttribution>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest packages/twenty-front/src/modules/brand/components/__tests__/BrandSourceAttribution.test.tsx --config=packages/twenty-front/jest.config.mjs`
Expected: PASS.

- [ ] **Step 5: Render it in the Settings drawer**

In `packages/twenty-front/src/modules/navigation/components/SettingsNavigationDrawerContent.tsx`, add the import (keep import order: `@/` group) and render the attribution right after the `AdvancedSettingsSwitch` section, only when the drawer is expanded:

```tsx
import { BrandSourceAttribution } from '@/brand/components/BrandSourceAttribution';
```

```tsx
      <StyledAdvancedSwitchFixedContent isMobile={isMobile}>
        <NavigationDrawerSection>
          <AdvancedSettingsSwitch
            className={advancedSettingsSwitchClassName}
            isAdvancedModeEnabled={isAdvancedModeEnabled}
            setIsAdvancedModeEnabled={setIsAdvancedModeEnabled}
            label={t`Advanced`}
            isCompact={!isNavigationDrawerExpanded}
          />
          {isNavigationDrawerExpanded && <BrandSourceAttribution />}
        </NavigationDrawerSection>
      </StyledAdvancedSwitchFixedContent>
```

- [ ] **Step 6: Run neighboring navigation tests, typecheck, lint**

Run: `npx jest packages/twenty-front/src/modules/navigation --config=packages/twenty-front/jest.config.mjs`
Expected: PASS.
Run: `cd packages/twenty-front && npx tsgo -p tsconfig.json --noEmit; cd ../.. && npx oxlint packages/twenty-front/src/modules/brand packages/twenty-front/src/modules/navigation/components/SettingsNavigationDrawerContent.tsx && npx oxfmt --check packages/twenty-front/src/modules/brand packages/twenty-front/src/modules/navigation/components/SettingsNavigationDrawerContent.tsx`
Expected: exit 0 / no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/twenty-front/src/modules/brand packages/twenty-front/src/modules/navigation/components/SettingsNavigationDrawerContent.tsx
git commit -m "feat(brand): add AGPL source attribution to settings drawer"
```

---

### Task 4: UI strings and front catalogs

**Files:**
- Modify: `packages/twenty-front/src/pages/auth/SignInUp.tsx:120`
- Modify: `packages/twenty-front/src/pages/not-found/NotFound.tsx:49`
- Modify: `packages/twenty-front/src/locales/{en,pt-BR,pt-PT}.po`
- Modify: `packages/twenty-front/src/locales/generated/{en,pt-BR,pt-PT}.ts`

**Interfaces:**
- Consumes: messages from Task 3 (`Built on Twenty (open source)`, `Source code`).

- [ ] **Step 1: Edit the source strings**

`packages/twenty-front/src/pages/auth/SignInUp.tsx` line 120:

```tsx
      return t`Welcome to colaborato.rio`;
```

`packages/twenty-front/src/pages/not-found/NotFound.tsx` line 49:

```tsx
      <PageTitle title={t`Page Not Found | colaborato.rio`} />
```

- [ ] **Step 2: Extract catalogs**

Run: `npx nx run twenty-front:lingui:extract`
Expected: completes; `git status packages/twenty-front/src/locales` lists many `.po` files.

- [ ] **Step 3: Translate the new entries in pt-BR and pt-PT**

In both `packages/twenty-front/src/locales/pt-BR.po` and `pt-PT.po`, find each new `msgid` (empty `msgstr ""`) and set:

```po
msgid "Welcome to colaborato.rio"
msgstr "Bem-vindo ao colaborato.rio"

msgid "Page Not Found | colaborato.rio"
msgstr "Página não encontrada | colaborato.rio"

msgid "Built on Twenty (open source)"
msgstr "Construído sobre Twenty (open source)"

msgid "Source code"
msgstr "Código-fonte"
```

Keep the `#. js-lingui-id:` comment lines generated by extract untouched. `en.po` needs no manual edit (source locale).

- [ ] **Step 4: Compile catalogs**

Run: `npx nx run twenty-front:lingui:compile`
Expected: completes; `grep -c "colaborato.rio" packages/twenty-front/src/locales/generated/pt-BR.ts` ≥ 2.

- [ ] **Step 5: Keep only en / pt-BR / pt-PT catalog changes**

```bash
git status --porcelain packages/twenty-front/src/locales \
  | awk '{print $2}' \
  | grep -vE '/(en|pt-BR|pt-PT)\.(po|ts)$' \
  | xargs -r git checkout --
git status --porcelain packages/twenty-front/src/locales
```
Expected: only the 6 files `en.po`, `pt-BR.po`, `pt-PT.po`, `generated/en.ts`, `generated/pt-BR.ts`, `generated/pt-PT.ts`.
Run: `git diff --stat packages/twenty-front/src/locales` — if any of these files shows more than ~60 changed lines, inspect with `git diff`; unrelated churn from upstream drift is acceptable but note it in the commit body.

- [ ] **Step 6: Verify rendering tests and typecheck**

Run: `npx jest packages/twenty-front/src/modules/brand --config=packages/twenty-front/jest.config.mjs`
Expected: PASS.
Run: `cd packages/twenty-front && npx tsgo -p tsconfig.json --noEmit; cd ../..`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/twenty-front/src/pages/auth/SignInUp.tsx packages/twenty-front/src/pages/not-found/NotFound.tsx packages/twenty-front/src/locales/en.po packages/twenty-front/src/locales/pt-BR.po packages/twenty-front/src/locales/pt-PT.po packages/twenty-front/src/locales/generated/en.ts packages/twenty-front/src/locales/generated/pt-BR.ts packages/twenty-front/src/locales/generated/pt-PT.ts
git commit -m "feat(brand): rename welcome and not-found titles to colaborato.rio"
```

---

### Task 5: Branded transactional emails

**Files:**
- Create: `packages/twenty-emails/src/constants/BrandEmailIdentity.ts`
- Modify: `packages/twenty-emails/src/components/Logo.tsx`
- Modify: `packages/twenty-emails/src/components/Footer.tsx`
- Modify: `packages/twenty-emails/src/components/WhatIsTwenty.tsx`
- Modify: `packages/twenty-emails/src/components/BaseHead.tsx`
- Modify: `packages/twenty-emails/src/locales/{en,pt-BR,pt-PT}.po` + `generated/{en,pt-BR,pt-PT}.ts`
- Test: `packages/twenty-server/src/engine/core-modules/email/__tests__/email-templates-rendering.spec.ts`

**Interfaces:**
- Consumes: email icon URL from Task 2 (`https://crm.colaborato.rio/images/icons/windows11/Square150x150Logo.scale-100.png`).
- Produces: `BRAND_EMAIL_IDENTITY: { name: string; websiteUrl: string; sourceCodeUrl: string; logoUrl: string }` (imported as `src/constants/BrandEmailIdentity`).

- [ ] **Step 1: Write the failing test**

In `packages/twenty-server/src/engine/core-modules/email/__tests__/email-templates-rendering.spec.ts`, add inside `describe('email templates rendering', …)`, after the non-english locale test:

```ts
  it('should render colaborato.rio branding instead of Twenty chrome', async () => {
    const html = await renderEmail(
      SendInviteLinkEmail({
        link: 'https://crm.colaborato.rio/invite/token',
        workspace: WORKSPACE,
        sender: SENDER,
        serverUrl: 'https://crm.colaborato.rio',
        locale: 'en',
      }),
    );

    expect(html).toContain('<title>colaborato.rio</title>');
    expect(html).toContain('What is colaborato.rio?');
    expect(html).toContain('https://colaborato.rio');
    expect(html).toContain('https://github.com/alexandrelt44/twenty');
    expect(html).toContain(
      'https://crm.colaborato.rio/images/icons/windows11/Square150x150Logo.scale-100.png',
    );
    expect(html).not.toContain('Public Benefit Corporation');
    expect(html).not.toContain('app.twenty.com/images');
  });
```

- [ ] **Step 2: Build emails and run the test to verify it fails**

The server consumes `twenty-emails` from its build output.
Run: `npx nx build twenty-emails --skip-nx-cache && npx jest packages/twenty-server/src/engine/core-modules/email/__tests__/email-templates-rendering.spec.ts --config=packages/twenty-server/jest.config.mjs -t "colaborato.rio branding"`
Expected: FAIL on `<title>colaborato.rio</title>`.

- [ ] **Step 3: Add the email brand constant**

`packages/twenty-emails/src/constants/BrandEmailIdentity.ts`:

```ts
// Emails render outside the app, so every URL must be absolute.
export const BRAND_EMAIL_IDENTITY = {
  name: 'colaborato.rio',
  websiteUrl: 'https://colaborato.rio',
  sourceCodeUrl: 'https://github.com/alexandrelt44/twenty',
  logoUrl:
    'https://crm.colaborato.rio/images/icons/windows11/Square150x150Logo.scale-100.png',
};
```

- [ ] **Step 4: Update `Logo.tsx`**

```tsx
import { Img } from 'react-email';

import { BRAND_EMAIL_IDENTITY } from 'src/constants/BrandEmailIdentity';

const logoStyle = {
  marginBottom: '40px',
};

export const Logo = () => {
  return (
    <Img
      src={BRAND_EMAIL_IDENTITY.logoUrl}
      alt={`${BRAND_EMAIL_IDENTITY.name} logo`}
      width="40"
      height="40"
      style={logoStyle}
    />
  );
};
```

- [ ] **Step 5: Update `BaseHead.tsx`**

Replace `<title>Twenty email</title>` with:

```tsx
      <title>{BRAND_EMAIL_IDENTITY.name}</title>
```

and add `import { BRAND_EMAIL_IDENTITY } from 'src/constants/BrandEmailIdentity';` after the `canvasTheme` import.

- [ ] **Step 6: Update `Footer.tsx`**

Replace the whole component body with:

```tsx
import { type I18n } from '@lingui/core';
import { Column, Container, Row } from 'react-email';

import { Link } from 'src/components/Link';
import { ShadowText } from 'src/components/ShadowText';
import { BRAND_EMAIL_IDENTITY } from 'src/constants/BrandEmailIdentity';

const footerContainerStyle = {
  marginTop: '12px',
};

type FooterProps = {
  i18n: I18n;
};

export const Footer = ({ i18n }: FooterProps) => {
  return (
    <Container style={footerContainerStyle}>
      <Row>
        <Column>
          <ShadowText>
            <Link
              href={BRAND_EMAIL_IDENTITY.websiteUrl}
              value={i18n._('Website')}
              aria-label={i18n._('Visit the colaborato.rio website')}
            />
          </ShadowText>
        </Column>
        <Column>
          <ShadowText>
            <Link
              href={BRAND_EMAIL_IDENTITY.sourceCodeUrl}
              value={i18n._('Source code')}
              aria-label={i18n._('View the source code of this CRM')}
            />
          </ShadowText>
        </Column>
      </Row>
      <ShadowText>
        <>
          {BRAND_EMAIL_IDENTITY.name}
          <br />
          {/* AGPLv3 §13: network users must be offered the source. */}
          {i18n._('Built on Twenty (open source)')}
        </>
      </ShadowText>
    </Container>
  );
};
```

- [ ] **Step 7: Update `WhatIsTwenty.tsx`**

Keep the file and component name (upstream imports it); change only the copy:

```tsx
export const WhatIsTwenty = ({ i18n }: WhatIsTwentyProps) => {
  return (
    <>
      <SubTitle value={i18n._('What is colaborato.rio?')} />
      <MainText>
        {i18n._(
          "It's the colaborato.rio CRM, where your team manages customers, deals and the AI agents that work with them.",
        )}
      </MainText>
    </>
  );
};
```

- [ ] **Step 8: Extract, translate and compile email catalogs**

Run: `npx nx run twenty-emails:lingui:extract`
In `packages/twenty-emails/src/locales/pt-BR.po` and `pt-PT.po` set the `msgstr` of the new entries:

```po
msgid "Visit the colaborato.rio website"
msgstr "Visitar o site da colaborato.rio"

msgid "Source code"
msgstr "Código-fonte"

msgid "View the source code of this CRM"
msgstr "Ver o código-fonte deste CRM"

msgid "Built on Twenty (open source)"
msgstr "Construído sobre Twenty (open source)"

msgid "What is colaborato.rio?"
msgstr "O que é o colaborato.rio?"

msgid "It's the colaborato.rio CRM, where your team manages customers, deals and the AI agents that work with them."
msgstr "É o CRM da colaborato.rio, onde sua equipe gerencia clientes, negócios e os agentes de IA que trabalham com eles."
```

Run: `npx nx run twenty-emails:lingui:compile`
Then restore other locales:

```bash
git status --porcelain packages/twenty-emails/src/locales \
  | awk '{print $2}' \
  | grep -vE '/(en|pt-BR|pt-PT)\.(po|ts)$' \
  | xargs -r git checkout --
git status --porcelain packages/twenty-emails/src/locales
```
Expected: only en/pt-BR/pt-PT `.po` and `generated/*.ts` remain modified.

- [ ] **Step 9: Rebuild emails and run the whole rendering spec**

Run: `npx nx build twenty-emails --skip-nx-cache && npx jest packages/twenty-server/src/engine/core-modules/email/__tests__/email-templates-rendering.spec.ts --config=packages/twenty-server/jest.config.mjs`
Expected: PASS (all templates, including the new branding test and the fr-FR test).

- [ ] **Step 10: Typecheck and lint**

Run: `npx nx typecheck twenty-emails && npx oxlint packages/twenty-emails/src && npx oxfmt --check packages/twenty-emails/src packages/twenty-server/src/engine/core-modules/email/__tests__/email-templates-rendering.spec.ts`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add packages/twenty-emails/src/constants/BrandEmailIdentity.ts packages/twenty-emails/src/components packages/twenty-emails/src/locales/en.po packages/twenty-emails/src/locales/pt-BR.po packages/twenty-emails/src/locales/pt-PT.po packages/twenty-emails/src/locales/generated packages/twenty-server/src/engine/core-modules/email/__tests__/email-templates-rendering.spec.ts
git status --porcelain packages/twenty-emails/src/locales/generated
git commit -m "feat(brand): brand transactional emails as colaborato.rio"
```
(If `git status` after `add` shows generated files for other locales staged, unstage them with `git restore --staged <file>` before committing.)

---

### Task 6: BRANDING.md and visual verification

**Files:**
- Create: `BRANDING.md`

**Interfaces:**
- Consumes: every file touched in Tasks 1–5.

- [ ] **Step 1: Write `BRANDING.md`**

````markdown
# colaborato.rio branding layer

This fork (`alexandrelt44/twenty`) ships the colaborato.rio CRM. Branding is a thin
layer over upstream Twenty. Spec: `docs/superpowers/specs/2026-09-16-colaboratorio-branding-design.md`.

## Fork-only files (never conflict)

- `packages/twenty-front/src/modules/brand/**` — theme CSS, identity constant, attribution
- `packages/twenty-front/scripts/brand/**` — icon source + generator
- `packages/twenty-emails/src/constants/BrandEmailIdentity.ts`
- `.github/workflows/fork-build-image.yaml`
- `BRANDING.md`

## Upstream files touched (may conflict on merge)

| File | Change | On conflict |
|---|---|---|
| `packages/twenty-front/src/index.tsx` | Outfit/JetBrains Mono imports + brand CSS as last import | Take upstream, re-add brand imports at the end |
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
| `packages/twenty-{front,emails}/src/locales/{en,pt-BR,pt-PT}.po` + `generated/*` | Brand strings | Take upstream, run `lingui:extract`, retranslate brand entries, `lingui:compile`, keep only these 3 locales |

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
````

- [ ] **Step 2: Commit**

```bash
git add BRANDING.md
git commit -m "docs(brand): add branding layer inventory and merge guide"
```

- [ ] **Step 3: Ask before resetting the local dev database**

The local DB is still v2.2 while the code is v2.42. **Ask the user** before running the reset (it wipes local data):
"Posso rodar `npx nx database:reset twenty-server` (apaga os dados do banco local de dev) para subir o app 2.42 e fazer a verificação visual?"
Only on yes: `bash packages/twenty-utils/setup-dev-env.sh && npx nx database:reset twenty-server`.

- [ ] **Step 4: Run the app and regenerate the pending GraphQL types**

Run (background): `yarn start`
When the server is up: `npx nx run twenty-front:graphql:generate --configuration=metadata`
If `git diff --stat packages/twenty-front/src/generated-metadata/graphql.ts` shows changes limited to ConnectedAgent/AgentActivity types, commit: `git commit -am "chore(byoa): regenerate metadata graphql types"`. If it shows unrelated churn, discard it with `git checkout -- packages/twenty-front/src/generated-metadata/graphql.ts` and report.

- [ ] **Step 5: Visual checklist (both themes)**

Use the Playwright MCP browser at `http://localhost:3001` ("Continue with Email", prefilled credentials). Toggle theme in Settings → Experience. Capture a screenshot for each and confirm:

1. Browser tab title `colaborato.rio`, favicon is the lightbulb.
2. Login: lightbulb logo; heading "Welcome to colaborato.rio" (global scope) or workspace name.
3. Sidebar: workspace avatar (lightbulb if no workspace logo), text in Outfit.
4. A record table (People): no truncation regressions vs. before; selected row/checkbox purple.
5. A primary button (e.g. "+ New record" / Settings save): purple background, white text readable.
6. Settings drawer bottom: "Built on Twenty (open source) · Source code" link opens GitHub fork.
7. `http://localhost:3001/does-not-exist`: tab title `Page Not Found | colaborato.rio`.
8. Code/JSON view (e.g. Settings → API playground or a workflow code step): JetBrains Mono.
9. Tags colored "blue" still blue.

Report any failure with the screenshot; fix inside `colaboratorio-theme.css` only (e.g. adjust a scale step) and re-run Task 1 tests.

- [ ] **Step 6: Push dev**

```bash
git push origin dev
```

---

### Task 7: GHCR image build workflow and `release` branch

**Files:**
- Create: `.github/workflows/fork-build-image.yaml`

**Interfaces:**
- Produces: image `ghcr.io/alexandrelt44/colaboratorio-crm` with tags `release`, `<TWENTY_CURRENT_VERSION>-colab.<run_number>`, `sha-<short sha>` (consumed by Task 8).

- [ ] **Step 1: Write the workflow**

`.github/workflows/fork-build-image.yaml`:

```yaml
name: Fork - build colaboratorio-crm image

on:
  push:
    branches: [release]
  workflow_dispatch:

permissions:
  contents: read
  packages: write

concurrency:
  group: fork-build-image-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    if: github.repository == 'alexandrelt44/twenty'
    runs-on: ubuntu-latest
    timeout-minutes: 150
    steps:
      - name: Free disk space
        uses: jlumbroso/free-disk-space@v1.3.1
        with:
          tool-cache: true

      - uses: actions/checkout@v4

      - name: Read Twenty version
        id: version
        run: |
          version="$(sed -n "s/.*TWENTY_CURRENT_VERSION = '\([^']*\)'.*/\1/p" packages/twenty-server/src/engine/core-modules/upgrade/constants/twenty-current-version.constant.ts)"
          test -n "$version"
          echo "twenty=$version" >> "$GITHUB_OUTPUT"

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/alexandrelt44/colaboratorio-crm
          tags: |
            type=raw,value=release,enable=${{ github.ref == 'refs/heads/release' }}
            type=raw,value=${{ steps.version.outputs.twenty }}-colab.${{ github.run_number }}
            type=sha,prefix=sha-

      - uses: docker/build-push-action@v6
        with:
          context: .
          file: packages/twenty-docker/twenty/Dockerfile
          platforms: linux/amd64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: |
            APP_VERSION=v${{ steps.version.outputs.twenty }}-colab.${{ github.run_number }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 2: Validate YAML locally**

Run: `node -e "require('yaml').parse(require('fs').readFileSync('.github/workflows/fork-build-image.yaml','utf8')); console.log('valid')"`
Expected: `valid` (if `yaml` isn't resolvable, use `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/fork-build-image.yaml')); print('valid')"`).

- [ ] **Step 3: Commit and push to dev**

```bash
git add .github/workflows/fork-build-image.yaml
git commit -m "ci(fork): build colaboratorio-crm image to GHCR"
git push origin dev
```

- [ ] **Step 4: Disable inherited upstream workflows on the fork**

```bash
gh workflow list --repo alexandrelt44/twenty --all --json name,path,state \
  --jq '.[] | select(.path != ".github/workflows/fork-build-image.yaml") | select(.state == "active") | .path' \
  | while read -r workflow_path; do
      gh workflow disable "$(basename "$workflow_path")" --repo alexandrelt44/twenty
    done
gh workflow list --repo alexandrelt44/twenty --all --json path,state --jq '.[] | select(.state == "active") | .path'
```
Expected: last command prints only `.github/workflows/fork-build-image.yaml` (or nothing yet — the workflow registers after the push to `release`). If GitHub says Actions are disabled for the fork, ask the user to enable them at `https://github.com/alexandrelt44/twenty/actions` ("I understand my workflows, go ahead and enable them").

- [ ] **Step 5: Create `release` and trigger the build**

**Ask the user first**: "Posso criar a branch `release` a partir da `dev` e disparar o primeiro build da imagem no GitHub Actions?"
On yes:

```bash
git push origin dev:release
gh run list --repo alexandrelt44/twenty --workflow fork-build-image.yaml --limit 1
```
Expected: a run `in_progress`. Watch with `gh run watch --repo alexandrelt44/twenty <run-id>` (build takes ~40–90 min).
Expected at the end: `completed success`. On failure, fetch logs with `gh run view <run-id> --log-failed --repo alexandrelt44/twenty` and report; if it fails on disk space or the 150-minute timeout, report to the user (fallback options: larger runner, or build locally with `docker buildx build --platform linux/amd64` and push).

- [ ] **Step 6: Verify the image and decide visibility**

```bash
docker manifest inspect ghcr.io/alexandrelt44/colaboratorio-crm:release > /dev/null && echo "image published"
```
New GHCR packages are private. **Ask the user** whether to make it public (recommended: the source is public under AGPL anyway; simplifies VPS pulls). Visibility is changed in the UI at `https://github.com/users/alexandrelt44/packages/container/colaboratorio-crm/settings` → "Change visibility". If kept private, Task 8 Step 3 needs a PAT with `read:packages`.

---

### Task 8: Deploy to the openclaw VPS

**Every step here touches production (`https://crm.colaborato.rio`). Get an explicit "yes" from the user before Step 2, and again before Step 5.**

**Files (remote, `vps-openclaw`):**
- Modify: `/home/openclaw/.openclaw/workspace/apps/twenty/.env`
- Modify: `/home/openclaw/.openclaw/workspace/apps/twenty/docker-compose.yml`

**Interfaces:**
- Consumes: `ghcr.io/alexandrelt44/colaboratorio-crm:<TWENTY_CURRENT_VERSION>-colab.<run>` from Task 7.

- [ ] **Step 1: Inspect current state (read-only)**

```bash
ssh vps-openclaw 'cd /home/openclaw/.openclaw/workspace/apps/twenty && docker compose ps && grep -n "image:\|SERVER_URL:\|APP_SECRET:" docker-compose.yml && cut -d= -f1 .env'
```
Expected: server/worker on `twentycrm/twenty:${TAG:-latest}`, `.env` keys without `ENCRYPTION_KEY`.

- [ ] **Step 2: Back up database, storage and config (after user "yes")**

```bash
ssh vps-openclaw 'set -euo pipefail
cd /home/openclaw/.openclaw/workspace/apps/twenty
backup_directory="/root/backups/twenty-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_directory"
set -a; . ./.env; set +a
docker exec twenty-db-1 pg_dumpall -U "$PG_DATABASE_USER" > "$backup_directory/databases.sql"
docker run --rm -v twenty_server-local-data:/data -v "$backup_directory":/backup alpine tar czf /backup/server-local-data.tgz -C /data .
cp .env docker-compose.yml "$backup_directory/"
ls -lh "$backup_directory"'
```
Expected: `databases.sql` non-empty (several MB), `server-local-data.tgz`, `.env`, `docker-compose.yml`. Record the backup path for rollback.

- [ ] **Step 3: Authenticate to GHCR (only if the package is private)**

Ask the user to run on the VPS themselves (the token must not pass through this session):
`! ssh -t vps-openclaw 'docker login ghcr.io -u alexandrelt44'` (password: PAT with `read:packages`).

- [ ] **Step 4: Add `ENCRYPTION_KEY` and switch the image**

```bash
ssh vps-openclaw 'set -euo pipefail
cd /home/openclaw/.openclaw/workspace/apps/twenty
grep -q "^ENCRYPTION_KEY=" .env || echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
sed -i "s|image: twentycrm/twenty:\${TAG:-latest}|image: ghcr.io/alexandrelt44/colaboratorio-crm:\${TAG:-latest}|" docker-compose.yml
grep -q "ENCRYPTION_KEY: \${ENCRYPTION_KEY}" docker-compose.yml || sed -i "s|^\(\s*\)SERVER_URL: \${SERVER_URL}|&\n\1ENCRYPTION_KEY: \${ENCRYPTION_KEY}|" docker-compose.yml
sed -i "s|^TAG=.*|TAG=<TAG_FROM_TASK_7>|" .env
grep -n "image:\|ENCRYPTION_KEY" docker-compose.yml
grep -n "^TAG=" .env
docker compose config --quiet && echo "compose valid"'
```
Replace `<TAG_FROM_TASK_7>` with the exact versioned tag produced in Task 7 (e.g. `2.42.0-colab.1`) — never `release` in production, so rollbacks are explicit.
Expected: server and worker `image:` lines point to GHCR; `ENCRYPTION_KEY: ${ENCRYPTION_KEY}` appears twice (server + worker); `compose valid`.

- [ ] **Step 5: Pull and restart (after second user "yes")**

```bash
ssh vps-openclaw 'set -euo pipefail
cd /home/openclaw/.openclaw/workspace/apps/twenty
docker compose pull server worker
docker compose up -d
sleep 5
docker compose ps'
```
Then follow the upgrade logs until the server is healthy (the entrypoint upgrades v2.2 → v2.42, including slow encryption backfills):
`ssh vps-openclaw 'docker logs -f --tail 200 twenty-server-1'` — stop following once "Nest application successfully started" (or the healthcheck turns `healthy` in `docker compose ps`).

- [ ] **Step 6: Verify upgrade status and smoke test**

```bash
ssh vps-openclaw 'docker exec twenty-server-1 yarn command:prod upgrade:status; docker exec twenty-server-1 sh -c "echo \$APP_VERSION"'
```
Expected: instance and every workspace `Up to date`; `APP_VERSION` = `v<version>-colab.<run>`.
Browser smoke test at `https://crm.colaborato.rio` (Playwright MCP): login works, lightbulb icon + `colaborato.rio` title, purple primary button, Settings → Connected Agents page loads, both themes render.

- [ ] **Step 7: Rollback procedure (only if Step 5/6 fails)**

```bash
ssh vps-openclaw 'set -euo pipefail
cd /home/openclaw/.openclaw/workspace/apps/twenty
backup_directory=<BACKUP_PATH_FROM_STEP_2>
docker compose down
cp "$backup_directory/docker-compose.yml" "$backup_directory/.env" .
docker compose up -d db redis
sleep 10
set -a; . ./.env; set +a
docker exec -i twenty-db-1 psql -U "$PG_DATABASE_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$PG_DATABASE_NAME\" WITH (FORCE);"
docker exec -i twenty-db-1 psql -U "$PG_DATABASE_USER" -d postgres < "$backup_directory/databases.sql"
docker compose up -d'
```
Ask the user before running rollback. Replace `<BACKUP_PATH_FROM_STEP_2>` with the path printed in Step 2.

- [ ] **Step 8: Record the deployment**

Update memory `reference-vps-openclaw` with: image tag deployed, backup path, `ENCRYPTION_KEY` present (never the value), date.
