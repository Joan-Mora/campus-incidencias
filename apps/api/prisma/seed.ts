import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  CATEGORIES_BY_SPACE,
  SLA_HOURS,
  SUGGESTED_RISK,
  combineSimilarity,
  computePriority,
  effectiveLevel,
  normalizeText,
  slaConsumed,
  tfidfCosine,
  tokenize,
  type Category,
  type IncidentStatus,
  type Point3,
  type PriorityLevel,
  type RiskLevel,
  type SpaceType,
} from '@campus/shared';
import { DESCRIPTIONS, FIX_NOTES, PARAPHRASES, createRandom, hotspotFor } from '../src/demo/content';

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../.env') });

const prisma = new PrismaClient();
const random = createRandom();
const NOW = new Date();
const HOUR = 3_600_000;
const PASSWORD = 'campus123';

interface BlockSeed {
  code: string;
  name: string;
  posX: number;
  posZ: number;
  width: number;
  depth: number;
  floors: number;
  rotation?: number;
  spaces: { floor: number; code: string; name: string; type: SpaceType; capacity: number }[];
}

function classrooms(floors: number[], perFloor: number, prefix = 'Aula'): BlockSeed['spaces'] {
  return floors.flatMap((floor) =>
    Array.from({ length: perFloor }, (_, i) => ({
      floor,
      code: `${floor}0${i + 1}`,
      name: `${prefix} ${floor}0${i + 1}`,
      type: 'CLASSROOM' as const,
      capacity: 35 + ((floor + i) % 3) * 10,
    })),
  );
}

const CAMPUSES: { code: string; name: string; blocks: BlockSeed[] }[] = [
  {
    code: 'PRI',
    name: 'Sede Principal',
    blocks: [
      {
        code: 'A',
        name: 'Bloque A · Aulas',
        posX: -20,
        posZ: -12,
        width: 18,
        depth: 10,
        floors: 4,
        spaces: [
          ...classrooms([1, 2, 3, 4], 2),
          { floor: 1, code: 'B1', name: 'Baño primer piso', type: 'BATHROOM', capacity: 12 },
          { floor: 3, code: 'B3', name: 'Baño tercer piso', type: 'BATHROOM', capacity: 12 },
        ],
      },
      {
        code: 'B',
        name: 'Bloque B · Laboratorios',
        posX: 16,
        posZ: -14,
        width: 14,
        depth: 12,
        floors: 3,
        rotation: 0.12,
        spaces: [
          { floor: 1, code: '101', name: 'Laboratorio de Electrónica', type: 'LAB', capacity: 30 },
          { floor: 1, code: '102', name: 'Laboratorio de Química', type: 'LAB', capacity: 28 },
          { floor: 2, code: '201', name: 'Laboratorio de Física', type: 'LAB', capacity: 30 },
          { floor: 2, code: '202', name: 'Sala de Cómputo 1', type: 'LAB', capacity: 40 },
          { floor: 3, code: '301', name: 'Sala de Cómputo 2', type: 'LAB', capacity: 40 },
          { floor: 3, code: '302', name: 'Laboratorio de Redes', type: 'LAB', capacity: 25 },
          { floor: 1, code: 'B1', name: 'Baño laboratorios', type: 'BATHROOM', capacity: 10 },
        ],
      },
      {
        code: 'C',
        name: 'Bloque C · Bienestar',
        posX: -18,
        posZ: 14,
        width: 16,
        depth: 10,
        floors: 2,
        rotation: -0.08,
        spaces: [
          { floor: 1, code: 'CAF', name: 'Cafetería', type: 'COMMON', capacity: 120 },
          { floor: 1, code: 'BIB', name: 'Biblioteca', type: 'COMMON', capacity: 90 },
          { floor: 2, code: 'AUD', name: 'Auditorio', type: 'COMMON', capacity: 200 },
          { floor: 2, code: 'B2', name: 'Baño bienestar', type: 'BATHROOM', capacity: 14 },
        ],
      },
      {
        code: 'D',
        name: 'Bloque D · Administrativo',
        posX: 18,
        posZ: 14,
        width: 12,
        depth: 10,
        floors: 3,
        spaces: [
          { floor: 1, code: 'REC', name: 'Recepción y atención', type: 'COMMON', capacity: 40 },
          { floor: 1, code: '102', name: 'Registro académico', type: 'OFFICE', capacity: 8 },
          { floor: 2, code: '201', name: 'Coordinación académica', type: 'OFFICE', capacity: 10 },
          { floor: 2, code: '202', name: 'Sala de profesores', type: 'OFFICE', capacity: 20 },
          { floor: 3, code: '301', name: 'Dirección de sede', type: 'OFFICE', capacity: 6 },
          { floor: 3, code: '302', name: 'Infraestructura', type: 'OFFICE', capacity: 8 },
        ],
      },
    ],
  },
  {
    code: 'NOR',
    name: 'Sede Norte',
    blocks: [
      {
        code: 'E',
        name: 'Bloque E · Aulas',
        posX: -12,
        posZ: -4,
        width: 16,
        depth: 10,
        floors: 3,
        spaces: [
          ...classrooms([1, 2, 3], 2),
          { floor: 1, code: 'B1', name: 'Baño principal', type: 'BATHROOM', capacity: 12 },
        ],
      },
      {
        code: 'F',
        name: 'Bloque F · Laboratorios',
        posX: 14,
        posZ: 4,
        width: 12,
        depth: 12,
        floors: 2,
        rotation: 0.2,
        spaces: [
          { floor: 1, code: '101', name: 'Laboratorio de Biología', type: 'LAB', capacity: 26 },
          { floor: 1, code: '102', name: 'Taller de Diseño', type: 'LAB', capacity: 30 },
          { floor: 2, code: '201', name: 'Sala de Cómputo Norte', type: 'LAB', capacity: 36 },
          { floor: 2, code: 'LOU', name: 'Zona de estudio', type: 'COMMON', capacity: 60 },
        ],
      },
    ],
  },
];

const USERS = [
  { name: 'Laura Méndez', email: 'supervisor@campus.edu.co', role: 'SUPERVISOR' as const },
  { name: 'Carlos Rojas', email: 'tecnico1@campus.edu.co', role: 'TECHNICIAN' as const },
  { name: 'Andrea Pineda', email: 'tecnico2@campus.edu.co', role: 'TECHNICIAN' as const },
  { name: 'Miguel Torres', email: 'tecnico3@campus.edu.co', role: 'TECHNICIAN' as const },
  { name: 'Valentina Ruiz', email: 'estudiante1@campus.edu.co', role: 'STUDENT' as const },
  { name: 'Santiago Herrera', email: 'estudiante2@campus.edu.co', role: 'STUDENT' as const },
  { name: 'Camila Ortiz', email: 'estudiante3@campus.edu.co', role: 'STUDENT' as const },
  { name: 'Juan Esteban Díaz', email: 'estudiante4@campus.edu.co', role: 'STUDENT' as const },
  { name: 'Sofía Castro', email: 'estudiante5@campus.edu.co', role: 'STUDENT' as const },
  { name: 'Mateo Vargas', email: 'estudiante6@campus.edu.co', role: 'STUDENT' as const },
];

interface SpaceInfo {
  id: string;
  code: string;
  type: SpaceType;
  capacity: number;
  floor: number;
  blockId: string;
  campusId: string;
  key: string;
}

interface Plan {
  space: SpaceInfo;
  category: Category;
  riskLevel: RiskLevel;
  description: string;
  hotspot: Point3 | null;
  createdAt: Date;
  reporterId: string;
  /** Horas desde la creación en que ocurre cada transición. */
  takeAfterH?: number;
  resolveAfterH?: number;
  verifyAfterH?: number;
  verifiedBySupervisor?: boolean;
}

type HistoryRow = Omit<Prisma.StatusHistoryCreateManyInput, 'incidentId'>;
type EventRow = Omit<Prisma.IncidentEventCreateManyInput, 'incidentId'>;

async function main() {
  // En el despliegue el seed corre en cada build; con --if-empty solo llena una base recién creada.
  if (process.argv.includes('--if-empty') && (await prisma.user.count()) > 0) {
    console.log('La base ya tiene datos, se omite el seed.');
    return;
  }

  console.log('Limpiando datos...');
  await prisma.$transaction([
    prisma.groupSuggestion.deleteMany(),
    prisma.incidentEvent.deleteMany(),
    prisma.statusHistory.deleteMany(),
    prisma.evidence.deleteMany(),
    prisma.incident.deleteMany(),
    prisma.incidentCluster.deleteMany(),
    prisma.space.deleteMany(),
    prisma.block.deleteMany(),
    prisma.campus.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  await prisma.$executeRawUnsafe('ALTER SEQUENCE "Incident_number_seq" RESTART WITH 1');

  console.log('Creando usuarios...');
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users = await Promise.all(USERS.map((user) => prisma.user.create({ data: { ...user, passwordHash } })));
  const students = users.filter((u) => u.role === 'STUDENT');
  const technicians = users.filter((u) => u.role === 'TECHNICIAN');
  const supervisor = users.find((u) => u.role === 'SUPERVISOR')!;

  console.log('Creando sedes, bloques y espacios...');
  const spaces: SpaceInfo[] = [];
  for (const campusSeed of CAMPUSES) {
    const campus = await prisma.campus.create({ data: { code: campusSeed.code, name: campusSeed.name } });
    for (const blockSeed of campusSeed.blocks) {
      const block = await prisma.block.create({
        data: {
          campusId: campus.id,
          code: blockSeed.code,
          name: blockSeed.name,
          posX: blockSeed.posX,
          posZ: blockSeed.posZ,
          width: blockSeed.width,
          depth: blockSeed.depth,
          floors: blockSeed.floors,
          rotation: blockSeed.rotation ?? 0,
        },
      });
      const byFloor = new Map<number, BlockSeed['spaces']>();
      for (const s of blockSeed.spaces) byFloor.set(s.floor, [...(byFloor.get(s.floor) ?? []), s]);
      for (const [, floorSpaces] of byFloor) {
        for (const [index, spaceSeed] of floorSpaces.entries()) {
          const localX = -blockSeed.width / 2 + ((index + 0.5) * blockSeed.width) / floorSpaces.length;
          const space = await prisma.space.create({
            data: {
              blockId: block.id,
              code: spaceSeed.code,
              name: spaceSeed.name,
              floor: spaceSeed.floor,
              type: spaceSeed.type,
              capacity: spaceSeed.capacity,
              qrToken: `${campusSeed.code}-${blockSeed.code}-${spaceSeed.code}`.toLowerCase(),
              localX: Math.round(localX * 100) / 100,
              localZ: 0,
            },
          });
          spaces.push({
            id: space.id,
            code: space.code,
            type: space.type,
            capacity: space.capacity,
            floor: space.floor,
            blockId: block.id,
            campusId: campus.id,
            key: `${campusSeed.code}-${blockSeed.code}-${spaceSeed.code}`,
          });
        }
      }
    }
  }
  const spaceByKey = new Map(spaces.map((s) => [s.key, s]));

  console.log('Generando incidencias con una semana de historia...');
  const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR);

  // Escenarios agrupados que muestran la detección de relacionadas.
  const clusters: { primary: Plan; members: Plan[] }[] = [];

  const scenario = (
    key: string,
    category: Category,
    primaryAgeH: number,
    memberOffsetsH: number[],
    timeline: Pick<Plan, 'takeAfterH' | 'resolveAfterH' | 'verifyAfterH'>,
    riskLevel: RiskLevel = SUGGESTED_RISK[category],
  ) => {
    const space = spaceByKey.get(key)!;
    const hotspot = hotspotFor(category, space.type, random);
    const primary: Plan = {
      space,
      category,
      riskLevel,
      description: DESCRIPTIONS[category][0],
      hotspot,
      createdAt: ago(primaryAgeH),
      reporterId: random.pick(students).id,
      ...timeline,
    };
    const members = memberOffsetsH.map((offset, i) => ({
      space,
      category,
      riskLevel,
      description: PARAPHRASES[category][i % PARAPHRASES[category].length],
      hotspot: random.chance(0.75) ? hotspotFor(category, space.type, random, hotspot) : null,
      createdAt: ago(primaryAgeH - offset),
      reporterId: students[(i + 1) % students.length].id,
    }));
    clusters.push({ primary, members });
  };

  scenario('PRI-A-201', 'LIGHTING', 30, [3, 7, 20], { takeAfterH: 26 });
  scenario('PRI-B-101', 'ELECTRICAL', 5.5, [0.6, 2.5], {}, 'HIGH');
  scenario('PRI-C-B2', 'SANITARY', 50, [4, 12], { takeAfterH: 6, resolveAfterH: 22 });
  scenario('NOR-E-102', 'WATER_LEAK', 14, [5], {});
  scenario('PRI-A-B1', 'WATER_LEAK', 120, [10, 30], { takeAfterH: 3, resolveAfterH: 20, verifyAfterH: 26 });

  const singles: Plan[] = [];
  const clusteredSpaces = new Set(clusters.map((c) => c.primary.space.id));
  for (let i = 0; i < 44; i++) {
    let space = random.pick(spaces);
    if (clusteredSpaces.has(space.id)) space = random.pick(spaces);
    const category = random.pick(CATEGORIES_BY_SPACE[space.type]);
    const ageH = random.range(0.5, 168);
    const plan: Plan = {
      space,
      category,
      riskLevel: random.chance(0.75) ? SUGGESTED_RISK[category] : random.pick(['LOW', 'MEDIUM', 'HIGH'] as RiskLevel[]),
      description: random.pick(DESCRIPTIONS[category]),
      hotspot: random.chance(0.7) ? hotspotFor(category, space.type, random) : null,
      createdAt: ago(ageH),
      reporterId: random.chance(0.85) ? random.pick(students).id : random.pick([supervisor, ...technicians]).id,
    };
    const roll = random.next();
    const progress =
      ageH > 72
        ? roll < 0.6 ? 3 : roll < 0.8 ? 2 : roll < 0.9 ? 1 : 0
        : ageH > 24
          ? roll < 0.25 ? 3 : roll < 0.5 ? 2 : roll < 0.8 ? 1 : 0
          : roll < 0.5 ? 0 : roll < 0.85 ? 1 : 2;
    if (progress >= 1) plan.takeAfterH = random.range(0.2, Math.min(ageH * 0.35, 30));
    if (progress >= 2) plan.resolveAfterH = plan.takeAfterH! + random.range(0.5, Math.max(0.6, (ageH - plan.takeAfterH!) * 0.6));
    if (progress >= 3) {
      plan.verifyAfterH = plan.resolveAfterH! + random.range(0.2, Math.max(0.3, (ageH - plan.resolveAfterH!) * 0.8));
      plan.verifiedBySupervisor = random.chance(0.4);
    }
    singles.push(plan);
  }

  const allPlans = [...singles, ...clusters.flatMap((c) => [c.primary, ...c.members])].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  // Se crean en orden cronológico para que los códigos sigan la línea de tiempo.
  const created = new Map<Plan, { id: string; level: PriorityLevel; score: number; assigneeId: string | null }>();
  const clusterOf = new Map<Plan, { primary: Plan; members: Plan[] }>();
  for (const cluster of clusters) {
    clusterOf.set(cluster.primary, cluster);
    for (const member of cluster.members) clusterOf.set(member, cluster);
  }

  for (const plan of allPlans) {
    const cluster = clusterOf.get(plan);
    const isMember = !!cluster && cluster.primary !== plan;
    if (isMember) continue;
    const similarCount = cluster ? 1 + cluster.members.length : 1;
    const result = await createWithTimeline(plan, similarCount, technicians.map((t) => t.id), supervisor.id);
    created.set(plan, result);
  }

  for (const cluster of clusters) {
    const primary = created.get(cluster.primary)!;
    const clusterRow = await prisma.incidentCluster.create({
      data: {
        primaryIncidentId: primary.id,
        spaceId: cluster.primary.space.id,
        category: cluster.primary.category,
        reportsCount: 1 + cluster.members.length,
      },
    });
    await prisma.incident.update({ where: { id: primary.id }, data: { clusterId: clusterRow.id, isClusterPrimary: true } });
    const primaryTokens = tokenize(cluster.primary.description);
    for (const member of cluster.members) {
      const memberId = await createMember(member, cluster.primary, primary, clusterRow.id);
      const [tfidf] = tfidfCosine(tokenize(member.description), [primaryTokens]);
      const similarity = combineSimilarity({
        location: { a: locationRef(member), b: locationRef(cluster.primary) },
        category: { a: member.category, b: cluster.primary.category },
        createdAt: { a: member.createdAt, b: cluster.primary.createdAt },
        tfidf,
      });
      await prisma.incidentEvent.create({
        data: {
          incidentId: memberId,
          type: 'GROUPED',
          payload: { clusterId: clusterRow.id, primaryIncidentId: primary.id, similarity, auto: true } as unknown as Prisma.InputJsonValue,
          createdAt: new Date(member.createdAt.getTime() + 2000),
        },
      });
    }
  }

  await createSuggestions(spaceByKey, students.map((s) => s.id));

  const total = await prisma.incident.count();
  console.log(`Listo: ${users.length} usuarios, ${spaces.length} espacios, ${total} incidencias.`);
  console.log(`Contraseña de todos los usuarios de prueba: ${PASSWORD}`);
}

function locationRef(plan: Plan) {
  return {
    campusId: plan.space.campusId,
    blockId: plan.space.blockId,
    floor: plan.space.floor,
    spaceId: plan.space.id,
    hotspot: plan.hotspot,
  };
}

async function createWithTimeline(plan: Plan, similarCount: number, technicianIds: string[], supervisorId: string) {
  const at = (hours: number) => new Date(plan.createdAt.getTime() + hours * HOUR);
  const takeAt = plan.takeAfterH != null ? at(plan.takeAfterH) : null;
  const resolveAt = plan.resolveAfterH != null ? at(plan.resolveAfterH) : null;
  const verifyAt = plan.verifyAfterH != null ? at(plan.verifyAfterH) : null;
  const technicianId = random.pick(technicianIds);

  const base = computePriority({
    riskLevel: plan.riskLevel,
    category: plan.category,
    similarCount,
    spaceType: plan.space.type,
    capacity: plan.space.capacity,
    slaConsumed: 0,
  });

  let steps = 0;
  let level = base.baseLevel;
  let isOverdue = false;
  let stageStart = plan.createdAt;
  let responseDueAt = new Date(plan.createdAt.getTime() + SLA_HOURS[level].response * HOUR);
  let resolutionDueAt = new Date(plan.createdAt.getTime() + SLA_HOURS[level].resolution * HOUR);
  const history: HistoryRow[] = [];
  const events: EventRow[] = [];
  let lastChange = plan.createdAt;

  const pushHistory = (row: Omit<HistoryRow, 'durationInPrevMs'>) => {
    const changedAt = row.changedAt as Date;
    history.push({ ...row, durationInPrevMs: row.fromStatus ? changedAt.getTime() - lastChange.getTime() : null });
    lastChange = changedAt;
  };

  pushHistory({ fromStatus: null, toStatus: 'PENDING', changedById: plan.reporterId, changedAt: plan.createdAt, reason: 'MANUAL' });
  events.push({
    type: 'CREATED',
    actorId: plan.reporterId,
    createdAt: plan.createdAt,
    payload: { score: base.score, level: base.baseLevel, breakdown: base.breakdown } as unknown as Prisma.InputJsonValue,
  });

  const escalateUntil = (status: IncidentStatus, kind: 'response' | 'resolution', limit: Date) => {
    for (let i = 0; i < 4; i++) {
      if (isOverdue && level === 'CRITICAL') return;
      const due = kind === 'response' ? responseDueAt : resolutionDueAt;
      if (due.getTime() >= limit.getTime()) return;
      const from = level;
      steps += 1;
      level = effectiveLevel(base.baseLevel, steps);
      isOverdue = true;
      responseDueAt = new Date(due.getTime() + SLA_HOURS[level].response * HOUR);
      resolutionDueAt = new Date(due.getTime() + SLA_HOURS[level].resolution * HOUR);
      pushHistory({ fromStatus: status, toStatus: status, changedById: null, changedAt: due, reason: 'AUTO_ESCALATION', note: `SLA de ${kind === 'response' ? 'respuesta' : 'resolución'} vencido` });
      events.push({ type: 'SLA_BREACHED', createdAt: due, payload: { kind, from, to: level } });
      if (from !== level) events.push({ type: 'PRIORITY_CHANGED', createdAt: due, payload: { from, to: level, reason: 'AUTO_ESCALATION' } });
    }
  };

  escalateUntil('PENDING', 'response', takeAt ?? NOW);
  let status: IncidentStatus = 'PENDING';
  let assigneeId: string | null = null;
  let firstResponseAt: Date | null = null;
  let resolvedAt: Date | null = null;
  let verifiedAt: Date | null = null;
  const evidence: Prisma.EvidenceCreateManyInput[] = [];

  if (takeAt) {
    assigneeId = technicianId;
    firstResponseAt = takeAt;
    status = 'IN_PROGRESS';
    stageStart = takeAt;
    pushHistory({ fromStatus: 'PENDING', toStatus: 'IN_PROGRESS', changedById: technicianId, changedAt: takeAt, reason: 'MANUAL' });
    events.push({ type: 'ASSIGNED', actorId: technicianId, createdAt: takeAt, payload: { assigneeId: technicianId } });
    escalateUntil('IN_PROGRESS', 'resolution', resolveAt ?? NOW);
  }
  if (resolveAt) {
    status = 'RESOLVED';
    resolvedAt = resolveAt;
    stageStart = resolveAt;
    pushHistory({ fromStatus: 'IN_PROGRESS', toStatus: 'RESOLVED', changedById: technicianId, changedAt: resolveAt, reason: 'MANUAL', note: FIX_NOTES[plan.category] });
    evidence.push({ incidentId: '', stage: 'FIX', kind: 'TEXT', text: FIX_NOTES[plan.category], createdAt: resolveAt });
  }
  if (verifyAt) {
    status = 'VERIFIED';
    verifiedAt = verifyAt;
    stageStart = verifyAt;
    const verifier = plan.verifiedBySupervisor ? supervisorId : plan.reporterId;
    pushHistory({ fromStatus: 'RESOLVED', toStatus: 'VERIFIED', changedById: verifier, changedAt: verifyAt, reason: 'MANUAL' });
  }

  const consumedAt = resolvedAt ?? NOW;
  const final = computePriority({
    riskLevel: plan.riskLevel,
    category: plan.category,
    similarCount,
    spaceType: plan.space.type,
    capacity: plan.space.capacity,
    slaConsumed: slaConsumed(consumedAt, plan.createdAt, resolutionDueAt),
  });
  const finalLevel = effectiveLevel(final.baseLevel, steps);

  const incident = await prisma.incident.create({
    data: {
      description: plan.description,
      descriptionNorm: normalizeText(plan.description),
      category: plan.category,
      riskLevel: plan.riskLevel,
      spaceId: plan.space.id,
      hotspotX: plan.hotspot?.x,
      hotspotY: plan.hotspot?.y,
      hotspotZ: plan.hotspot?.z,
      reporterId: plan.reporterId,
      assigneeId,
      status,
      priorityScore: final.score,
      priorityLevel: finalLevel,
      priorityBreakdown: final.breakdown as unknown as Prisma.InputJsonValue,
      escalationSteps: steps,
      isOverdue,
      responseDueAt,
      resolutionDueAt,
      createdAt: plan.createdAt,
      stageStartedAt: stageStart,
      firstResponseAt,
      resolvedAt,
      verifiedAt,
    },
  });
  await prisma.statusHistory.createMany({ data: history.map((row) => ({ ...row, incidentId: incident.id })) });
  await prisma.incidentEvent.createMany({ data: events.map((row) => ({ ...row, incidentId: incident.id })) });
  if (evidence.length) await prisma.evidence.createMany({ data: evidence.map((row) => ({ ...row, incidentId: incident.id })) });
  return { id: incident.id, level: finalLevel, score: final.score, assigneeId };
}

async function createMember(
  member: Plan,
  primaryPlan: Plan,
  primary: { id: string; level: PriorityLevel; score: number; assigneeId: string | null },
  clusterId: string,
) {
  const primaryRow = await prisma.incident.findUniqueOrThrow({
    where: { id: primary.id },
    include: { history: { orderBy: { changedAt: 'asc' } } },
  });
  const history: HistoryRow[] = [
    { fromStatus: null, toStatus: 'PENDING', changedById: member.reporterId, changedAt: member.createdAt, reason: 'MANUAL', durationInPrevMs: null },
  ];
  let status: IncidentStatus = 'PENDING';
  let last = member.createdAt;
  for (const row of primaryRow.history) {
    if (!row.fromStatus || row.fromStatus === row.toStatus) continue;
    if (row.toStatus === status) continue;
    const changedAt = row.changedAt.getTime() < member.createdAt.getTime() ? new Date(member.createdAt.getTime() + 60_000) : row.changedAt;
    history.push({
      fromStatus: status,
      toStatus: row.toStatus,
      changedById: row.changedById,
      changedAt,
      reason: 'CLUSTER_PROPAGATION',
      durationInPrevMs: changedAt.getTime() - last.getTime(),
    });
    status = row.toStatus;
    last = changedAt;
  }
  const incident = await prisma.incident.create({
    data: {
      description: member.description,
      descriptionNorm: normalizeText(member.description),
      category: member.category,
      riskLevel: member.riskLevel,
      spaceId: member.space.id,
      hotspotX: member.hotspot?.x,
      hotspotY: member.hotspot?.y,
      hotspotZ: member.hotspot?.z,
      reporterId: member.reporterId,
      assigneeId: primaryRow.assigneeId,
      status,
      priorityScore: primaryRow.priorityScore,
      priorityLevel: primaryRow.priorityLevel,
      priorityBreakdown: primaryRow.priorityBreakdown as Prisma.InputJsonValue,
      escalationSteps: primaryRow.escalationSteps,
      isOverdue: primaryRow.isOverdue,
      responseDueAt: primaryRow.responseDueAt,
      resolutionDueAt: primaryRow.resolutionDueAt,
      createdAt: member.createdAt,
      stageStartedAt: last,
      firstResponseAt: primaryRow.firstResponseAt,
      resolvedAt: primaryRow.resolvedAt,
      verifiedAt: primaryRow.verifiedAt,
      clusterId,
      isClusterPrimary: false,
    },
  });
  await prisma.statusHistory.createMany({ data: history.map((row) => ({ ...row, incidentId: incident.id })) });
  await prisma.incidentEvent.create({
    data: {
      incidentId: incident.id,
      type: 'CREATED',
      actorId: member.reporterId,
      createdAt: member.createdAt,
      payload: { joinedPrimary: primaryPlan.description },
    },
  });
  return incident.id;
}

async function createSuggestions(spaceByKey: Map<string, SpaceInfo>, studentIds: string[]) {
  const pairs: [string, string, Category, string, string][] = [
    ['PRI-A-301', 'PRI-A-302', 'LIGHTING', 'La lámpara del salón parpadea y se apaga', 'Las luces titilan todo el tiempo, parece que se van a fundir'],
    ['PRI-B-201', 'PRI-B-202', 'ELECTRICAL', 'La toma del mesón central no funciona y huele a quemado', 'El enchufe junto al computador huele a quemado'],
  ];
  for (const [keyA, keyB, category, textA, textB] of pairs) {
    const ids: string[] = [];
    for (const [index, key] of [keyA, keyB].entries()) {
      const space = spaceByKey.get(key)!;
      const plan: Plan = {
        space,
        category,
        riskLevel: SUGGESTED_RISK[category],
        description: index === 0 ? textA : textB,
        hotspot: null,
        createdAt: new Date(NOW.getTime() - (index === 0 ? 9 : 4) * HOUR),
        reporterId: studentIds[index + 2],
      };
      const result = await createWithTimeline(plan, 1, [], '');
      ids.push(result.id);
    }
    const [a, b] = await Promise.all(ids.map((id) => prisma.incident.findUniqueOrThrow({ where: { id }, include: { space: { include: { block: true } } } })));
    const [tfidf] = tfidfCosine(tokenize(b.description), [tokenize(a.description)]);
    const ref = (row: typeof a) => ({
      campusId: row.space.block.campusId,
      blockId: row.space.blockId,
      floor: row.space.floor,
      spaceId: row.spaceId,
      hotspot: null,
    });
    const breakdown = combineSimilarity({
      location: { a: ref(b), b: ref(a) },
      category: { a: b.category, b: a.category },
      createdAt: { a: b.createdAt, b: a.createdAt },
      tfidf,
    });
    await prisma.groupSuggestion.create({
      data: {
        incidentId: b.id,
        candidateId: a.id,
        score: breakdown.score,
        breakdown: breakdown as unknown as Prisma.InputJsonValue,
        createdAt: b.createdAt,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
