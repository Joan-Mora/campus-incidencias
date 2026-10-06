import { ROOM_DIMENSIONS, type Category, type Point3, type SpaceType } from '@campus/shared';

/** Generador pseudoaleatorio con semilla para que el seed sea reproducible. */
export function createRandom(seed = 20261006) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    range: (min: number, max: number) => next() * (max - min) + min,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    chance: (probability: number) => next() < probability,
  };
}

export type Random = ReturnType<typeof createRandom>;

export const DESCRIPTIONS: Record<Category, string[]> = {
  LIGHTING: [
    'El bombillo del fondo está fundido y no se ve bien el tablero',
    'No prende la luz del lado de la ventana',
    'La lámpara parpadea todo el tiempo y molesta en clase',
    'Hay dos tubos de luz quemados en la mitad del salón',
    'La luminaria sobre el tablero no enciende',
    'Se fue la luz de la fila de atrás, quedó oscuro',
  ],
  ELECTRICAL: [
    'Hay un cable expuesto cerca de la toma del escritorio del docente',
    'La toma de la pared echa chispas al conectar el cargador',
    'El tomacorriente está suelto y se ven los cables pelados',
    'Da corriente al tocar la caja del interruptor',
    'El enchufe del videobeam está quemado y huele a plástico',
  ],
  WATER_LEAK: [
    'Hay una gotera grande en el techo cerca de la puerta',
    'Sale agua por debajo del lavamanos y se forma un charco',
    'Filtración de agua en la pared del fondo, el piso está mojado',
    'La tubería gotea sin parar desde ayer',
    'Cae agua del techo cuando llueve, justo encima de las sillas',
  ],
  STRUCTURAL: [
    'La puerta no cierra, la bisagra está rota',
    'Hay una grieta en la pared que va creciendo',
    'Se cayó una placa del cielorraso',
    'Una baldosa del piso está levantada y la gente se tropieza',
    'La ventana no cierra y el vidrio está rajado',
  ],
  SANITARY: [
    'El inodoro del segundo cubículo está tapado',
    'El orinal no descarga',
    'El desagüe del lavamanos está obstruido',
    'La llave del lavamanos no cierra bien y se desperdicia agua',
  ],
  FURNITURE: [
    'Hay tres pupitres con la pata rota',
    'La silla del docente está partida',
    'La mesa de trabajo está floja y se mueve',
    'El tablero acrílico está despegado de la pared',
  ],
  COSMETIC: [
    'La pared tiene rayones y grafitis',
    'La pintura del muro se está cayendo',
    'Hay manchas de humedad en el techo',
    'Las sillas están rayadas con marcador',
  ],
};

/** Variantes con otra redacción del mismo daño, para demostrar la agrupación. */
export const PARAPHRASES: Record<Category, string[]> = {
  LIGHTING: ['No prende la luz del salón, la lámpara está quemada', 'La luminaria de adelante no alumbra', 'El foco está fundido otra vez'],
  ELECTRICAL: ['Cables al aire junto al enchufe del docente, es peligroso', 'La toma tiene los cables expuestos', 'Sale chispa del tomacorriente'],
  WATER_LEAK: ['Gotea el techo al lado de la puerta', 'Hay un charco por la gotera de la entrada', 'Se filtra agua por el techo'],
  STRUCTURAL: ['La puerta quedó descolgada y no cierra', 'La grieta de la pared está más grande', 'Falta una placa del techo'],
  SANITARY: ['El sanitario del segundo cubículo no funciona, está tapado', 'El inodoro está obstruido', 'El lavamanos no desagua'],
  FURNITURE: ['Varios pupitres rotos en la fila de atrás', 'Las sillas tienen las patas partidas', 'La mesa se mueve mucho'],
  COSMETIC: ['Rayaron la pared con marcador', 'La pared está llena de grafitis', 'Se está cayendo la pintura'],
};

/** Punto plausible del daño dentro del modelo 3D del espacio. */
export function hotspotFor(category: Category, type: SpaceType, random: Random, near?: Point3 | null): Point3 {
  if (near) {
    return {
      x: round(near.x + random.range(-0.7, 0.7)),
      y: near.y,
      z: round(near.z + random.range(-0.7, 0.7)),
    };
  }
  const { width, depth, height } = ROOM_DIMENSIONS[type];
  const halfW = width / 2 - 0.6;
  const halfD = depth / 2 - 0.6;
  switch (category) {
    case 'LIGHTING':
      return { x: round(random.range(-halfW, halfW)), y: round(height - 0.05), z: round(random.range(-halfD, halfD)) };
    case 'ELECTRICAL':
      return { x: round(random.range(-halfW, halfW)), y: 0.4, z: round(-depth / 2 + 0.05) };
    case 'WATER_LEAK':
      return random.chance(0.5)
        ? { x: round(random.range(-halfW, halfW)), y: round(height - 0.05), z: round(random.range(-halfD, halfD)) }
        : { x: round(random.range(-halfW, halfW)), y: 0.02, z: round(random.range(-halfD, halfD)) };
    case 'STRUCTURAL':
      return { x: round(width / 2 - 0.05), y: round(random.range(0.5, 2.2)), z: round(random.range(-halfD, halfD)) };
    case 'SANITARY':
      return { x: round(random.range(-halfW, halfW)), y: 0.45, z: round(depth / 2 - 0.5) };
    case 'FURNITURE':
      return { x: round(random.range(-halfW, halfW)), y: 0.5, z: round(random.range(-halfD + 1, halfD)) };
    case 'COSMETIC':
    default:
      return { x: round(random.range(-halfW, halfW)), y: round(random.range(0.8, 2.4)), z: round(-depth / 2 + 0.05) };
  }
}

const round = (value: number) => Math.round(value * 100) / 100;

export const FIX_NOTES: Record<Category, string> = {
  LIGHTING: 'Se reemplazó la luminaria por una LED nueva y se probó el encendido.',
  ELECTRICAL: 'Se aisló el cableado, se cambió la toma y se verificó con multímetro.',
  WATER_LEAK: 'Se selló la tubería y se impermeabilizó el punto de filtración.',
  STRUCTURAL: 'Se ajustó la estructura y se reemplazaron las piezas dañadas.',
  SANITARY: 'Se destapó la tubería y se cambió el empaque de la descarga.',
  FURNITURE: 'Se repararon las piezas y se reforzaron las uniones.',
  COSMETIC: 'Se limpió y se repintó la superficie.',
};
