#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = process.cwd();
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'dev-dist', '.git', 'uploads', 'coverage', '.vite', 'migrations']);
const IGNORED_FILES = new Set(['package-lock.json']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.mdc', '.css', '.html', '.prisma', '.yml', '.yaml', '.txt']);

// Pictogramas, dingbats, banderas, selectores de variacion y modificadores de tono de piel.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{E0020}-\u{E007F}]|\u{FE0F}|\u{200D}|\u{20E3}/u;

const stagedOnly = process.argv.includes('--files');
const files = stagedOnly ? process.argv.slice(process.argv.indexOf('--files') + 1) : walk(ROOT);

const offenders = [];
for (const file of files) {
  if (!EXTENSIONS.has(extname(file))) continue;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(EMOJI);
    if (match) offenders.push(`${relative(ROOT, file)}:${index + 1}  ${JSON.stringify(match[0])}`);
  });
}

if (offenders.length > 0) {
  console.error('Se encontraron emojis o pictogramas. Usa iconos de Lucide en su lugar:\n');
  for (const offender of offenders) console.error(`  ${offender}`);
  process.exit(1);
}

console.log(`check-no-emoji: ${files.length} archivos revisados, sin emojis.`);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry) || IGNORED_FILES.has(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
