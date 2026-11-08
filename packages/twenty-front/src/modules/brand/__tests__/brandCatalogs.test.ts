import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { i18n, setupI18n } from '@lingui/core';
import { t } from '@lingui/core/macro';
import { generateMessageId } from '@lingui/message-utils/generateMessageId';

import { BRAND_IDENTITY } from '@/brand/constants/BrandIdentity';
import { messages as frontDeMessages } from '~/locales/generated/de-DE';
import { messages as frontEnMessages } from '~/locales/generated/en';
import { messages as frontPtBrMessages } from '~/locales/generated/pt-BR';

const PACKAGES_DIRECTORY = path.resolve(__dirname, '../../../../..');

const CATALOG_DIRECTORIES = [
  'twenty-front/src/locales',
  'twenty-emails/src/locales',
  'twenty-server/src/engine/core-modules/i18n/locales',
].map((directory) => path.join(PACKAGES_DIRECTORY, directory));

const FORBIDDEN_BRAND_PATTERN = /\bTwenty\b|\btwenty\.com\b/;

type BrandCatalogRules = {
  productName: string;
  exceptions: Record<string, string>;
};

const RULES: BrandCatalogRules = JSON.parse(
  readFileSync(
    path.resolve(
      __dirname,
      '../../../../scripts/brand/brand-catalog-rules.json',
    ),
    'utf8',
  ),
);

type CatalogEntry = { msgid: string; msgstr: string };

const decodePoSegment = (segment: string) =>
  segment
    .replace(/^(?:msgid|msgstr) /, '')
    .replace(/^"|"$/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');

const parseCatalogEntries = (catalog: string): CatalogEntry[] =>
  catalog.split('\n\n').flatMap((block) => {
    const lines = block.split('\n').filter((line) => !line.startsWith('#'));
    const msgstrIndex = lines.findIndex((line) => line.startsWith('msgstr '));

    if (msgstrIndex === -1 || !lines[0]?.startsWith('msgid ')) {
      return [];
    }

    return [
      {
        msgid: lines.slice(0, msgstrIndex).map(decodePoSegment).join(''),
        msgstr: lines.slice(msgstrIndex).map(decodePoSegment).join(''),
      },
    ];
  });

const findCatalogViolations = (catalog: string) =>
  parseCatalogEntries(catalog)
    .filter(
      ({ msgid, msgstr }) =>
        msgid !== '' &&
        !(msgid in RULES.exceptions) &&
        FORBIDDEN_BRAND_PATTERN.test(msgstr),
    )
    .map(({ msgid, msgstr }) => `${msgid} => ${msgstr}`);

const listFiles = (directory: string, extension: string) =>
  readdirSync(directory)
    .filter((file) => file.endsWith(extension))
    .map((file) => path.join(directory, file));

const loadCompiledMessageTexts = (file: string): string[] => {
  const literal = readFileSync(file, 'utf8').match(
    /JSON\.parse\(("[\s\S]*")\)\s*as/,
  )?.[1];

  if (literal === undefined) {
    throw new Error(`Unexpected compiled catalog format: ${file}`);
  }

  const messages: Record<string, unknown> = JSON.parse(
    vm.runInNewContext(literal),
  );

  return Object.values(messages)
    .flat()
    .filter((token): token is string => typeof token === 'string');
};

describe('brand catalogs', () => {
  it('uses the product name declared by the brand identity', () => {
    expect(RULES.productName).toBe(BRAND_IDENTITY.name);
  });

  it('flags a Twenty mention outside the exception list', () => {
    const catalog = [
      'msgid "Built on Twenty (open source)"',
      'msgstr "Built on Twenty (open source)"',
      '',
      'msgid "Upstream regression"',
      'msgstr "Twenty is back"',
    ].join('\n');

    expect(findCatalogViolations(catalog)).toEqual([
      'Upstream regression => Twenty is back',
    ]);
  });

  it.each(CATALOG_DIRECTORIES)('has no Twenty msgstr in %s', (directory) => {
    const violations = listFiles(directory, '.po').flatMap((file) =>
      findCatalogViolations(readFileSync(file, 'utf8')).map(
        (violation) => `${path.basename(file)}: ${violation}`,
      ),
    );

    expect(violations).toEqual([]);
  });

  it.each(CATALOG_DIRECTORIES)(
    'has recompiled catalogs without Twenty in %s',
    (directory) => {
      const allowedTexts = new Set(
        listFiles(directory, '.po').flatMap((file) =>
          parseCatalogEntries(readFileSync(file, 'utf8'))
            .filter(({ msgid }) => msgid in RULES.exceptions)
            .flatMap(({ msgid, msgstr }) => [msgid, msgstr]),
        ),
      );

      const violations = listFiles(
        path.join(directory, 'generated'),
        '.ts',
      ).flatMap((file) =>
        loadCompiledMessageTexts(file)
          .filter(
            (text) =>
              FORBIDDEN_BRAND_PATTERN.test(text) && !allowedTexts.has(text),
          )
          .map((text) => `${path.basename(file)}: ${text}`),
      );

      expect(violations).toEqual([]);
    },
  );
});

describe('English msgstr at runtime', () => {
  const brandName = BRAND_IDENTITY.name;

  it('wins over the msgid in the front source locale', () => {
    i18n.load('en', frontEnMessages);
    i18n.activate('en');

    expect(t`Twenty fields`).toBe('ColabCRM fields');
    expect(t`Welcome to ${brandName}`).toBe('Welcome to ColabCRM');
  });

  it('wins for a translated locale', () => {
    i18n.load('pt-BR', frontPtBrMessages);
    i18n.activate('pt-BR');

    expect(t`Twenty fields`).toBe('Campos do ColabCRM');
    expect(t`Welcome to ${brandName}`).toBe('Bem-vindo ao ColabCRM');
  });

  it('falls back to the English msgstr for untranslated brand strings', () => {
    i18n.load('de-DE', frontDeMessages);
    i18n.activate('de-DE');

    expect(t`Welcome to ${brandName}`).toBe('Welcome to ColabCRM');
  });

  it('wins in the compiled server and email catalogs', async () => {
    const { messages: serverMessages } =
      await import('../../../../../twenty-server/src/engine/core-modules/i18n/locales/generated/en');
    const { messages: emailMessages } =
      await import('../../../../../twenty-emails/src/locales/generated/en');

    const serverI18n = setupI18n({
      locale: 'en',
      messages: { en: serverMessages },
    });
    const emailI18n = setupI18n({
      locale: 'en',
      messages: { en: emailMessages },
    });

    expect(serverI18n._(generateMessageId('Join your team on Twenty'))).toBe(
      'Join your team on ColabCRM',
    );
    expect(emailI18n._('Join your team on {brandName}', { brandName })).toBe(
      'Join your team on ColabCRM',
    );
  });
});
