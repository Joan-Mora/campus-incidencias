export const STOPWORDS_ES = new Set(
  `a al algo algun alguna algunas alguno algunos ante antes aqui asi aun cada como con contra cual cuando de del desde donde
  dos el ella ellas ellos en entre era es esa esas ese eso esos esta estaba estan estar este esto estos fue ha hace hay
  hasta la las le les lo los mas me mi mis mucho muy nada ni no nos o otra otro para pero poco por porque que quien se
  sea ser si sin sobre son su sus tambien tan tanto te tiene todo todos tu un una unas uno unos y ya yo salon aula
  favor ayuda hola buenas dias tardes noches gracias senor senora parte esta estan esto llevan lleva hace ahi alli
  momento rato bastante super demasiado`
    .split(/\s+/)
    .filter(Boolean),
);

/** Frases que se reemplazan antes de quitar palabras vacías, porque "no" cambia el sentido. */
const PHRASES: [RegExp, string][] = [
  [/\bno (prende|enciende|alumbra|sirve la luz)\b/g, 'fundido'],
  [/\bse (fue|apago) la luz\b/g, 'fundido'],
  [/\bsin luz\b/g, 'luminaria fundido'],
  [/\bno (funciona|sirve|abre|cierra)\b/g, 'danado'],
  [/\bsale agua\b|\bse sale el agua\b|\bcae agua\b/g, 'fuga'],
  [/\bda (corriente|choque)\b|\bdio corriente\b/g, 'descarga'],
  [/\bal aire\b|\bexpuestos?\b|\bpelados?\b/g, 'expuesto'],
];

/** Sinónimos del campus llevados a una forma canónica. */
const SYNONYMS: Record<string, string> = {
  bombillo: 'luminaria', bombillos: 'luminaria', bombilla: 'luminaria', bombillas: 'luminaria', foco: 'luminaria',
  focos: 'luminaria', lampara: 'luminaria', lamparas: 'luminaria', luz: 'luminaria', luces: 'luminaria',
  luminarias: 'luminaria', tubo: 'luminaria', tubos: 'luminaria', panel: 'luminaria', reflector: 'luminaria',
  quemado: 'fundido', quemada: 'fundido', fundida: 'fundido', fundidos: 'fundido', apagado: 'fundido', apagada: 'fundido',
  parpadea: 'fundido', titila: 'fundido', intermitente: 'fundido',
  gotera: 'fuga', goteras: 'fuga', goteo: 'fuga', gotea: 'fuga', filtracion: 'fuga', filtraciones: 'fuga', escape: 'fuga',
  fugas: 'fuga', inundado: 'fuga', inundacion: 'fuga', charco: 'fuga', humedad: 'fuga', mojado: 'fuga',
  enchufe: 'toma', enchufes: 'toma', tomacorriente: 'toma', tomacorrientes: 'toma', tomas: 'toma',
  cables: 'cable', cableado: 'cable', alambre: 'cable', alambres: 'cable',
  corrientazo: 'descarga', chispa: 'descarga', chispas: 'descarga', cortocircuito: 'descarga', corto: 'descarga',
  pupitre: 'silla', pupitres: 'silla', sillas: 'silla', asiento: 'silla', asientos: 'silla', butaca: 'silla',
  mesas: 'mesa', escritorio: 'mesa', escritorios: 'mesa',
  vidrio: 'ventana', vidrios: 'ventana', ventanas: 'ventana', cristal: 'ventana',
  puertas: 'puerta', chapa: 'cerradura', cerraduras: 'cerradura', manija: 'cerradura',
  inodoro: 'sanitario', inodoros: 'sanitario', taza: 'sanitario', sanitarios: 'sanitario', orinal: 'sanitario',
  lavamanos: 'grifo', lavabo: 'grifo', grifos: 'grifo', llave: 'grifo', canilla: 'grifo',
  desague: 'drenaje', tapado: 'drenaje', tapada: 'drenaje', obstruido: 'drenaje', atascado: 'drenaje',
  roto: 'danado', rota: 'danado', rotos: 'danado', rotas: 'danado', danada: 'danado', danados: 'danado',
  averiado: 'danado', averiada: 'danado', estropeado: 'danado', malo: 'danado', mala: 'danado', partido: 'danado',
  grieta: 'fisura', grietas: 'fisura', agrietado: 'fisura', fisuras: 'fisura', rajado: 'fisura',
  techo: 'cielorraso', plafon: 'cielorraso', tejas: 'cielorraso',
  rayado: 'rayon', rayada: 'rayon', rayones: 'rayon', grafiti: 'rayon', pintado: 'rayon', manchado: 'mancha',
  proyector: 'videobeam', videobeam: 'videobeam', video: 'videobeam',
};

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stemmer ligero en español; el API puede inyectar uno más completo. */
export function lightStemEs(word: string): string {
  if (word.length <= 4) return word;
  const suffixes = [
    'amientos', 'imientos', 'amiento', 'imiento', 'aciones', 'uciones', 'idades', 'mente', 'acion', 'ucion', 'idad',
    'ables', 'ibles', 'able', 'ible', 'ando', 'iendo', 'ados', 'adas', 'idos', 'idas', 'ado', 'ada', 'ido', 'ida',
    'es', 'os', 'as', 'o', 'a', 'e', 's',
  ];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) return word.slice(0, -suffix.length);
  }
  return word;
}

export type Stemmer = (word: string) => string;

export function tokenize(text: string, stem: Stemmer = lightStemEs): string[] {
  let normalized = normalizeText(text);
  for (const [pattern, replacement] of PHRASES) normalized = normalized.replace(pattern, replacement);
  return normalized
    .split(' ')
    .filter((word) => word.length > 1 && !STOPWORDS_ES.has(word) && !/^\d+$/.test(word))
    .map((word) => SYNONYMS[word] ?? word)
    .map((word) => stem(word));
}
