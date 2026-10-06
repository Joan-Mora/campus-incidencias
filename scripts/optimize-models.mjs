#!/usr/bin/env node
/**
 * Optimiza los modelos glTF de assets-src/ hacia apps/web/public/models/.
 * Compresión meshopt, texturas webp reducidas y geometría simplificada.
 * Uso: npm run models  (o node scripts/optimize-models.mjs --only CommonTree_1)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'assets-src');
const outputDir = join(root, 'apps/web/public/models');
const cli = join(root, 'node_modules/@gltf-transform/cli/bin/cli.js');

/** Ajustes por familia: los árboles se ven de lejos y toleran más simplificación. */
const PRESETS = {
  nature: { textureSize: 256, simplifyRatio: 0.45, simplifyError: 0.002 },
  default: { textureSize: 512, simplifyRatio: 0.75, simplifyError: 0.001 },
};

const onlyIndex = process.argv.indexOf('--only');
const only = onlyIndex > -1 ? process.argv[onlyIndex + 1] : null;

function findModels(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...findModels(full));
    else if (/\.(gltf|glb)$/i.test(entry)) found.push(full);
  }
  return found;
}

if (!existsSync(sourceDir)) {
  console.error('No existe assets-src/. Copia ahí los modelos CC0 antes de optimizar.');
  process.exit(1);
}
mkdirSync(outputDir, { recursive: true });

const models = findModels(sourceDir).filter((file) => !only || basename(file).startsWith(only));
let totalIn = 0;
let totalOut = 0;

for (const input of models) {
  const family = basename(dirname(input));
  const preset = PRESETS[family] ?? PRESETS.default;
  const name = basename(input).replace(/\.(gltf|glb)$/i, '');
  const output = join(outputDir, `${name}.glb`);
  execFileSync(
    process.execPath,
    [
      cli,
      'optimize',
      input,
      output,
      '--compress',
      'meshopt',
      '--texture-compress',
      'webp',
      '--texture-size',
      String(preset.textureSize),
      '--simplify-ratio',
      String(preset.simplifyRatio),
      '--simplify-error',
      String(preset.simplifyError),
    ],
    { stdio: 'pipe' },
  );
  const sizeIn = sourceSize(input);
  const sizeOut = statSync(output).size;
  totalIn += sizeIn;
  totalOut += sizeOut;
  console.log(`${name.padEnd(18)} ${kb(sizeIn).padStart(9)} -> ${kb(sizeOut).padStart(8)}`);
}

console.log(`\n${models.length} modelos: ${kb(totalIn)} -> ${kb(totalOut)}`);

/** Tamaño del glTF más sus binarios y texturas referenciados. */
function sourceSize(file) {
  if (file.endsWith('.glb')) return statSync(file).size;
  const dir = dirname(file);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const uris = [...(json.buffers ?? []), ...(json.images ?? [])].map((item) => item.uri).filter(Boolean);
  return statSync(file).size + uris.reduce((sum, uri) => sum + (existsSync(join(dir, uri)) ? statSync(join(dir, uri)).size : 0), 0);
}

function kb(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}
