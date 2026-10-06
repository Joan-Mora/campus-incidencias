/**
 * Simulador de la demo: reporta daños por la API cada pocos segundos, como lo harían estudiantes reales.
 *
 * Va por HTTP y no directo a la base para que cada reporte pase por la prioridad, la similitud,
 * los eventos y el WebSocket: el centro de mando lo ve aparecer igual que un reporte desde el celular.
 *
 * Cada "historia" es un daño que varias personas reportan con redacciones distintas y puntos cercanos
 * en el salón 3D, para que la agrupación automática se vea en vivo. Entre historias hay reportes sueltos.
 *
 * Uso: npm run simulate -- [--interval 6] [--count 20] [--api http://127.0.0.1:4100]
 */
import { parseArgs } from 'node:util';
import {
  CATEGORIES_BY_SPACE,
  PRIORITY_LABELS,
  SUGGESTED_RISK,
  RISK_LEVELS,
  type CampusDTO,
  type Category,
  type IncidentDTO,
  type Point3,
  type RiskLevel,
  type SpaceDTO,
  type UserDTO,
} from '@campus/shared';
import { env } from '../common/env';
import { DESCRIPTIONS, PARAPHRASES, createRandom, hotspotFor } from '../demo/content';

const { values: args } = parseArgs({
  options: {
    interval: { type: 'string', default: '6' },
    count: { type: 'string', default: '0' },
    api: { type: 'string', default: `http://127.0.0.1:${env.PORT}` },
  },
});

const INTERVAL_MS = Math.max(1, Number(args.interval)) * 1000;
const MAX_REPORTS = Math.max(0, Number(args.count));
const API = args.api.replace(/\/$/, '');
const PASSWORD = 'campus123';
const random = createRandom(Date.now() % 100_000);

interface Reporter {
  user: UserDTO;
  token: string;
}

interface Story {
  space: SpaceDTO;
  blockName: string;
  category: Category;
  riskLevel: RiskLevel;
  origin: Point3;
  remaining: string[];
  reported: number;
}

class ApiError extends Error {}

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new ApiError(body.error ?? `HTTP ${response.status} en ${path}`);
  return body;
}

/** Con el acceso rápido activo se usa cada estudiante del seed; si no, la contraseña de prueba. */
async function loginStudents(): Promise<Reporter[]> {
  const demo = await request<{ enabled: boolean; users: UserDTO[] }>('/api/auth/dev-users');
  const students = demo.users.filter((user) => user.role === 'STUDENT');
  if (demo.enabled && students.length > 0) {
    return Promise.all(
      students.map(async (student) => {
        const { token, user } = await request<{ token: string; user: UserDTO }>('/api/auth/dev-login', {
          method: 'POST',
          body: JSON.stringify({ role: 'STUDENT', userId: student.id }),
        });
        return { token, user };
      }),
    );
  }
  const reporters: Reporter[] = [];
  for (let i = 1; i <= 6; i++) {
    try {
      reporters.push(
        await request<Reporter>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: `estudiante${i}@campus.edu.co`, password: PASSWORD }),
        }),
      );
    } catch {
      // Ese estudiante no existe en esta base; se sigue con los demás.
    }
  }
  return reporters;
}

function allSpaces(campuses: CampusDTO[]) {
  return campuses.flatMap((campus) => campus.blocks.flatMap((block) => block.spaces.map((space) => ({ space, blockName: block.name }))));
}

/** A veces la persona percibe más riesgo del sugerido; así la cola no queda toda en el mismo nivel. */
function perceivedRisk(category: Category): RiskLevel {
  const base = RISK_LEVELS.indexOf(SUGGESTED_RISK[category]);
  const shift = random.chance(0.25) ? 1 : random.chance(0.1) ? -1 : 0;
  return RISK_LEVELS[Math.min(RISK_LEVELS.length - 1, Math.max(0, base + shift))]!;
}

/** Un daño nuevo: con `retellings` > 0 otras personas lo vuelven a reportar con sus palabras. */
function newStory(spaces: ReturnType<typeof allSpaces>, retellings: number): Story {
  const { space, blockName } = random.pick(spaces);
  const category = random.pick(CATEGORIES_BY_SPACE[space.type]);
  const paraphrases = [...PARAPHRASES[category]].sort(() => random.next() - 0.5);
  return {
    space,
    blockName,
    category,
    riskLevel: perceivedRisk(category),
    origin: hotspotFor(category, space.type, random),
    // Las paráfrasis cuentan el primer daño de cada categoría; un reporte suelto puede ser cualquiera.
    remaining: retellings > 0 ? [DESCRIPTIONS[category][0]!, ...paraphrases.slice(0, retellings)] : [random.pick(DESCRIPTIONS[category])],
    reported: 0,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function describe(incident: IncidentDTO) {
  const cluster = incident.clusterId && !incident.isClusterPrimary ? 'agrupado' : incident.clusterSize > 1 ? `madre de ${incident.clusterSize}` : 'nuevo';
  return `${incident.code}  ${PRIORITY_LABELS[incident.priorityLevel].padEnd(7)} ${incident.priorityScore.toFixed(1).padStart(5)}  ${cluster.padEnd(10)}`;
}

async function main() {
  console.log(`Simulador de reportes contra ${API}, uno cada ${INTERVAL_MS / 1000} s${MAX_REPORTS ? `, ${MAX_REPORTS} en total` : ''}.`);

  const health = await request<{ slaTimeScale: number }>('/api/health').catch(() => {
    throw new ApiError(`No hay API en ${API}. Arranca primero "npm run dev".`);
  });
  if (health.slaTimeScale === 1) console.log('Consejo: con SLA_TIME_SCALE=60 en .env los vencimientos se ven en minutos.');

  const reporters = await loginStudents();
  if (reporters.length === 0) throw new ApiError('No hay estudiantes para reportar. Corre "npm run db:seed".');
  const campuses = await request<CampusDTO[]>('/api/locations', { token: reporters[0]!.token });
  const spaces = allSpaces(campuses);
  console.log(`${reporters.length} estudiantes, ${spaces.length} espacios. Ctrl+C para detener.\n`);

  let story: Story | null = null;
  let sent = 0;
  let stopping = false;
  process.on('SIGINT', () => {
    stopping = true;
  });

  while (!stopping && (MAX_REPORTS === 0 || sent < MAX_REPORTS)) {
    if (!story || story.remaining.length === 0) {
      story = newStory(spaces, random.chance(0.7) ? random.int(1, 2) : 0);
    }
    const description = story.remaining.shift()!;
    const reporter = random.pick(reporters);
    const hotspot = story.reported === 0 ? story.origin : hotspotFor(story.category, story.space.type, random, story.origin);
    story.reported += 1;

    try {
      const created = await request<IncidentDTO>('/api/incidents', {
        method: 'POST',
        token: reporter.token,
        body: JSON.stringify({ spaceId: story.space.id, category: story.category, riskLevel: story.riskLevel, description, hotspot }),
      });
      sent += 1;
      // La similitud corre en segundo plano al recibir el evento; se espera un instante para mostrar el resultado.
      await sleep(900);
      const settled = await request<IncidentDTO>(`/api/incidents/${created.id}`, { token: reporter.token }).catch(() => created);
      console.log(`${describe(settled)}  ${story.space.name}, ${story.blockName}  "${description}"  (${reporter.user.name})`);
    } catch (error) {
      console.error(`No se pudo reportar: ${(error as Error).message}`);
      if ((error as Error).message.includes('Demasiadas')) await sleep(15_000);
    }

    await sleep(Math.max(0, INTERVAL_MS * random.range(0.6, 1.4) - 900));
  }

  console.log(`\nListo: ${sent} reportes enviados.`);
}

main().catch((error) => {
  console.error(error instanceof ApiError ? error.message : error);
  process.exit(1);
});
