import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = dirname(fileURLToPath(import.meta.url));
export const API_ROOT = resolve(here, '../..');
export const REPO_ROOT = resolve(API_ROOT, '../..');

config({ path: resolve(REPO_ROOT, '.env'), quiet: true });
// La librería `natural` llama a dotenv al importarse e imprime avisos en cada arranque.
process.env.DOTENV_CONFIG_QUIET ??= 'true';

const flag = z
  .string()
  .optional()
  .transform((value) => ['1', 'true', 'on', 'yes'].includes((value ?? '').toLowerCase()));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url('DATABASE_URL debe ser una URL de PostgreSQL'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  ALLOW_DEV_LOGIN: flag,
  SLA_TIME_SCALE: z.coerce.number().min(1).max(3600).default(1),
  SIMILARITY_EMBEDDINGS: flag,
  STORAGE_DRIVER: z.enum(['local', 'database']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Variables de entorno inválidas:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  uploadDir: resolve(API_ROOT, parsed.data.UPLOAD_DIR),
  corsOrigins: parsed.data.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
};
