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
        getContrastRatio(getHexValue(block, '--t-accent-accent11'), background),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );
});
