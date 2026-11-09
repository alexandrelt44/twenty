#!/usr/bin/env node
// Rewrites msgstr, never msgid, so upstream .tsx files stay untouched and the
// rebrand can be reapplied after every upstream merge with one command.
// Usage: node packages/twenty-front/scripts/brand/apply-brand-catalogs.mjs [--no-compile]
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, '../../..');

const CATALOGS = [
  { packageName: 'twenty-front', localesPath: 'src/locales' },
  { packageName: 'twenty-emails', localesPath: 'src/locales' },
  {
    packageName: 'twenty-server',
    localesPath: 'src/engine/core-modules/i18n/locales',
  },
];

const RULES = JSON.parse(
  readFileSync(path.join(SCRIPT_DIRECTORY, 'brand-catalog-rules.json'), 'utf8'),
);

const PO_ESCAPES = { n: '\n', t: '\t', r: '\r' };

// Some catalogs carry raw control characters, which JSON.parse rejects.
const decodePoLine = (line) =>
  line
    .slice(line.indexOf('"') + 1, line.trimEnd().lastIndexOf('"'))
    .replace(
      /\\(.)/g,
      (_match, character) => PO_ESCAPES[character] ?? character,
    );

const encodePoString = (text) =>
  `"${text
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')
    .replaceAll('\t', '\\t')
    .replaceAll('\r', '\\r')}"`;

const rewriteText = (text) =>
  text
    .replace(/\[([^\]]*)\]\(https?:\/\/(?:[\w-]+\.)*twenty\.com[^)]*\)/g, '$1')
    .replace(/https?:\/\/(?:[\w-]+\.)*twenty\.com\S*/g, RULES.exampleDomain)
    .replace(/\btwenty\.com\b/g, RULES.exampleDomain)
    .replace(/\bTwenty\b/g, RULES.productName)
    .replaceAll('트웬티', RULES.productName);

const rewriteCatalog = (source, locale) => {
  const lines = source.split('\n');
  const output = [];
  let index = 0;
  let changedEntries = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.startsWith('msgid ')) {
      output.push(line);
      index += 1;
      continue;
    }

    let msgid = decodePoLine(line);
    output.push(line);
    index += 1;

    while (lines[index]?.startsWith('"')) {
      msgid += decodePoLine(lines[index]);
      output.push(lines[index]);
      index += 1;
    }

    if (!lines[index]?.startsWith('msgstr ')) {
      continue;
    }

    const msgstrStart = index;
    let msgstr = decodePoLine(lines[index]);
    index += 1;

    while (lines[index]?.startsWith('"')) {
      msgstr += decodePoLine(lines[index]);
      index += 1;
    }

    const translation = RULES.translations[msgid]?.[locale];
    let rewritten = msgstr;

    if (translation !== undefined) {
      rewritten = translation;
    } else if (
      locale === 'en' &&
      msgstr === '' &&
      msgid in RULES.translations
    ) {
      rewritten = msgid;
    } else if (!(msgid in RULES.exceptions)) {
      rewritten = rewriteText(msgstr);
    }

    if (rewritten === msgstr) {
      output.push(...lines.slice(msgstrStart, index));
      continue;
    }

    changedEntries += 1;

    if (rewritten.includes('\n')) {
      const parts = rewritten.split(/(?<=\n)/);
      output.push('msgstr ""', ...parts.map(encodePoString));
    } else {
      output.push(`msgstr ${encodePoString(rewritten)}`);
    }
  }

  return { content: output.join('\n'), changedEntries };
};

let totalChangedEntries = 0;

for (const { packageName, localesPath } of CATALOGS) {
  const directory = path.join(PACKAGES_DIRECTORY, packageName, localesPath);

  for (const file of readdirSync(directory).filter((name) =>
    name.endsWith('.po'),
  )) {
    const catalogPath = path.join(directory, file);
    const { content, changedEntries } = rewriteCatalog(
      readFileSync(catalogPath, 'utf8'),
      file.replace(/\.po$/, ''),
    );

    if (changedEntries > 0) {
      writeFileSync(catalogPath, content);
      totalChangedEntries += changedEntries;
    }
  }

  if (!process.argv.includes('--no-compile')) {
    execFileSync('npx', ['lingui', 'compile', '--typescript'], {
      cwd: path.join(PACKAGES_DIRECTORY, packageName),
      stdio: 'inherit',
    });
  }
}

console.log(
  `Brand catalog rewrite changed ${totalChangedEntries} msgstr entries.`,
);
