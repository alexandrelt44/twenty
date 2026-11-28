import { readFileSync } from 'fs';
import { resolve } from 'path';

const readRelativeFile = (relativePath: string) =>
  readFileSync(resolve(__dirname, relativePath), 'utf8');

const BRAND_CSS_PATH = '../colaboratorio-theme.css';
const UPSTREAM_THEME_PATHS = {
  light: '../../../../../twenty-ui/src/theme-constants/theme-light.css',
  dark: '../../../../../twenty-ui/src/theme-constants/theme-dark.css',
};

const SIDEBAR_SELECTOR = ".light [data-click-outside-id='navigation-drawer']";
const CURRENT_ITEM_SELECTOR =
  ".light [data-click-outside-id='navigation-drawer'] button[aria-current='true']";

type ColorSchemeClass = keyof typeof UPSTREAM_THEME_PATHS;

const getSelectorBlocks = (css: string, colorSchemeClass: ColorSchemeClass) =>
  [...css.matchAll(new RegExp(`\\.${colorSchemeClass}\\s*\\{([^}]*)\\}`, 'g'))]
    .map((match) => match[1])
    .join('\n');

const getDeclaredVariableNames = (block: string) =>
  [...block.matchAll(/(--t-[a-z0-9-]+)\s*:/g)].map((match) => match[1]);

const getReferencedVariableNames = (css: string) =>
  [...css.matchAll(/var\((--t-[a-z0-9-]+)/g)].map((match) => match[1]);

const getRuleBlock = (css: string, selectorFragment: string) => {
  const rule = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find((match) =>
    match[1].trim().endsWith(selectorFragment),
  );

  if (rule === undefined) {
    throw new Error(`No rule with selector ${selectorFragment}`);
  }

  return rule[2];
};

const getHexValue = (block: string, variableName: string) => {
  const match = block.match(
    new RegExp(`(?<![\\w-])${variableName}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`),
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
      const upstreamCss = readRelativeFile(
        UPSTREAM_THEME_PATHS[colorSchemeClass],
      );
      const upstreamVariableNames = new Set([
        ...getDeclaredVariableNames(
          getSelectorBlocks(upstreamCss, colorSchemeClass),
        ),
        ...getReferencedVariableNames(upstreamCss),
      ]);
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

  it('should only re-map upstream light variables inside the sidebar', () => {
    const upstreamCss = readRelativeFile(UPSTREAM_THEME_PATHS.light);
    const upstreamVariableNames = new Set(
      getDeclaredVariableNames(getSelectorBlocks(upstreamCss, 'light')),
    );
    const sidebarVariableNames = [
      ...getDeclaredVariableNames(getRuleBlock(brandCss, SIDEBAR_SELECTOR)),
      ...getDeclaredVariableNames(
        getRuleBlock(brandCss, CURRENT_ITEM_SELECTOR),
      ),
    ];

    expect(sidebarVariableNames.length).toBeGreaterThan(0);
    expect(
      sidebarVariableNames.filter(
        (variableName) => !upstreamVariableNames.has(variableName),
      ),
    ).toEqual([]);
  });

  it('should keep the warm neutrals WCAG AA readable on the light surfaces', () => {
    const block = getSelectorBlocks(brandCss, 'light');
    const surfaces = [
      getHexValue(block, '--t-background-primary'),
      getHexValue(block, '--t-background-secondary'),
      getHexValue(block, '--t-background-tertiary'),
    ];

    for (const surface of surfaces) {
      expect(
        getContrastRatio(getHexValue(block, '--t-font-color-primary'), surface),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(
          getHexValue(block, '--t-font-color-secondary'),
          surface,
        ),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(getHexValue(block, '--t-color-blue'), surface),
      ).toBeGreaterThanOrEqual(4.5);
    }

    // Tertiary is for placeholders and empty values, as in the ColabOS.
    expect(
      getContrastRatio(
        getHexValue(block, '--t-font-color-tertiary'),
        getHexValue(block, '--t-background-primary'),
      ),
    ).toBeGreaterThanOrEqual(3);
  });

  it('should keep the dark sidebar and its current item WCAG AA readable', () => {
    const sidebarBlock = getRuleBlock(brandCss, SIDEBAR_SELECTOR);
    const currentItemBlock = getRuleBlock(brandCss, CURRENT_ITEM_SELECTOR);
    const sidebarBackground = getHexValue(sidebarBlock, 'background-color');

    for (const variableName of [
      '--t-font-color-primary',
      '--t-font-color-secondary',
      '--t-font-color-tertiary',
    ]) {
      expect(
        getContrastRatio(
          getHexValue(sidebarBlock, variableName),
          sidebarBackground,
        ),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(
          getHexValue(currentItemBlock, variableName),
          getHexValue(currentItemBlock, 'background'),
        ),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    // oxlint-disable-next-line twenty/no-hardcoded-colors
    { colorSchemeClass: 'light', background: '#ffffff' },
    // oxlint-disable-next-line twenty/no-hardcoded-colors
    { colorSchemeClass: 'dark', background: '#171717' },
  ] as const)(
    'should keep brand colors WCAG AA readable in $colorSchemeClass mode',
    ({ colorSchemeClass, background }) => {
      const block = getSelectorBlocks(brandCss, colorSchemeClass);

      // oxlint-disable-next-line twenty/no-hardcoded-colors
      const whiteColor = '#ffffff';
      expect(
        getContrastRatio(whiteColor, getHexValue(block, '--t-color-blue')),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(whiteColor, getHexValue(block, '--t-accent-accent9')),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(getHexValue(block, '--t-accent-accent11'), background),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );
});
