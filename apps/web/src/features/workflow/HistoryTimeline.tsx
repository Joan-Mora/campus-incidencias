import { motion } from 'framer-motion';
import {
  HISTORY_REASON_LABELS,
  PRIORITY_LABELS,
  STATUS_FLOW,
  STATUS_LABELS,
  explainSimilarity,
  formatDuration,
  type SimilarityBreakdown,
  type IncidentDetailDTO,
  type IncidentEventDTO,
  type IncidentStatus,
  type PriorityLevel,
  type StatusHistoryDTO,
} from '@campus/shared';
import { fadeUp, stagger } from '../../core/motion';
import { cn } from '../../ui/cn';
import { formatNumber } from '../../ui/format';
import { Icon } from '../../ui/Icon';
import { HISTORY_REASON_ICONS, Icons, STATUS_ICONS, type LucideIcon } from '../../ui/icons';

const PRIORITY_REASON_LABELS: Record<string, string> = {
  AUTO_ESCALATION: 'escalamiento por SLA',
  GROUPED: 'se sumaron reportes',
  UNGROUPED: 'se separó un reporte',
  RISK_CORRECTED: 'riesgo corregido',
  AGE: 'antigüedad del reporte',
};

const GROUP_MODE_LABELS: Record<string, string> = {
  auto: 'automático',
  joined: 'el estudiante se sumó',
  manual: 'fusión manual',
  suggestion: 'sugerencia aceptada',
};

const STATUS_SHADE: Record<IncidentStatus, number> = { PENDING: 0.35, IN_PROGRESS: 0.65, RESOLVED: 0.9, VERIFIED: 1 };

/** Tiempo acumulado en cada etapa a partir de StatusHistory, más la etapa en curso. */
export function stageDurations(detail: Pick<IncidentDetailDTO, 'history' | 'status'>, now: Date) {
  const totals: Record<IncidentStatus, number> = { PENDING: 0, IN_PROGRESS: 0, RESOLVED: 0, VERIFIED: 0 };
  for (const entry of detail.history) {
    if (entry.fromStatus && entry.durationInPrevMs) totals[entry.fromStatus] += entry.durationInPrevMs;
  }
  const last = detail.history.at(-1);
  if (last && detail.status !== 'VERIFIED') totals[detail.status] += now.getTime() - new Date(last.changedAt).getTime();
  return totals;
}

export function StageBar({ detail, now }: { detail: Pick<IncidentDetailDTO, 'history' | 'status'>; now: Date }) {
  const totals = stageDurations(detail, now);
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  const stages = STATUS_FLOW.filter((status) => status !== 'VERIFIED');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface ring-1 ring-line">
        {stages.map((status) => (
          <motion.div
            key={status}
            initial={{ width: 0 }}
            animate={{ width: `${(totals[status] / sum) * 100}%` }}
            className="h-full"
            style={{ background: 'var(--accent)', opacity: STATUS_SHADE[status] }}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stages.map((status) => (
          <div key={status} className="rounded-xl border border-line bg-surface px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <Icon icon={STATUS_ICONS[status]} size={12} />
              {STATUS_LABELS[status]}
            </div>
            <div className="font-mono text-sm tabular">{totals[status] ? formatDuration(totals[status]) : '-'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TimelineItem {
  id: string;
  at: string;
  icon: LucideIcon;
  title: string;
  detail?: string | null;
  actor?: string | null;
  tone: 'accent' | 'critical' | 'high' | 'muted' | 'low';
  duration?: number | null;
}

function fromHistory(entry: StatusHistoryDTO): TimelineItem | null {
  if (entry.fromStatus === entry.toStatus) return null;
  return {
    id: `h-${entry.id}`,
    at: entry.changedAt,
    icon: entry.fromStatus ? HISTORY_REASON_ICONS[entry.reason] : STATUS_ICONS.PENDING,
    title: entry.fromStatus ? `${STATUS_LABELS[entry.fromStatus]} a ${STATUS_LABELS[entry.toStatus]}` : 'Reporte registrado',
    detail: entry.note ?? (entry.reason !== 'MANUAL' ? HISTORY_REASON_LABELS[entry.reason] : null),
    actor: entry.changedBy?.name,
    tone: entry.toStatus === 'VERIFIED' || entry.toStatus === 'RESOLVED' ? 'low' : 'accent',
    duration: entry.fromStatus ? entry.durationInPrevMs : null,
  };
}

function fromEvent(event: IncidentEventDTO): TimelineItem | null {
  const payload = event.payload as Record<string, unknown>;
  const base = { id: `e-${event.id}`, at: event.createdAt, actor: event.actor?.name };
  switch (event.type) {
    case 'PRIORITY_CHANGED': {
      const from = payload.from as PriorityLevel | undefined;
      const to = payload.to as PriorityLevel | undefined;
      if (!from || !to || from === to) return null;
      const reason = typeof payload.reason === 'string' ? (PRIORITY_REASON_LABELS[payload.reason] ?? null) : null;
      const score = typeof payload.score === 'number' ? `puntaje ${formatNumber(payload.score)}` : null;
      return {
        ...base,
        icon: Icons.gauge,
        title: `Prioridad ${PRIORITY_LABELS[from]} a ${PRIORITY_LABELS[to]}`,
        detail: [reason, score].filter(Boolean).join(', ') || null,
        tone: 'high',
      };
    }
    case 'SLA_BREACHED':
      return { ...base, icon: Icons.alarm, title: 'SLA vencido, se escala un nivel', detail: payload.kind === 'response' ? 'Sin respuesta a tiempo' : 'Sin resolver a tiempo', tone: 'critical' };
    case 'SLA_WARNING':
      return { ...base, icon: Icons.timer, title: 'SLA al 80 %', detail: 'Aviso al técnico y al supervisor', tone: 'high' };
    case 'GROUPED':
      return {
        ...base,
        icon: Icons.merge,
        title: payload.joinedIncidentId ? 'Se sumó un reporte al grupo' : `Agrupado (${GROUP_MODE_LABELS[String(payload.mode)] ?? 'automático'})`,
        detail: payload.similarity ? explainSimilarity(payload.similarity as SimilarityBreakdown) : null,
        tone: 'accent',
      };
    case 'UNGROUPED':
      return { ...base, icon: Icons.unlink, title: 'Separado del grupo', tone: 'muted' };
    case 'COMMENT':
      return { ...base, icon: Icons.message, title: 'Comentario', detail: payload.text ? String(payload.text) : null, tone: 'muted' };
    case 'ASSIGNED':
      return { ...base, icon: Icons.user, title: 'Caso asignado', tone: 'accent' };
    case 'RISK_CORRECTED':
      return { ...base, icon: Icons.warning, title: 'Riesgo corregido por supervisión', detail: payload.note ? String(payload.note) : null, tone: 'high' };
    default:
      return null;
  }
}

const TONE: Record<TimelineItem['tone'], string> = {
  accent: 'text-accent bg-accent/12 border-accent/30',
  critical: 'text-level-critical bg-level-critical/12 border-level-critical/30',
  high: 'text-level-high bg-level-high/12 border-level-high/30',
  low: 'text-level-low bg-level-low/12 border-level-low/30',
  muted: 'text-muted bg-surface border-line',
};

const timeFormat = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Línea de tiempo animada con transiciones, escalamientos, agrupaciones y comentarios. */
export function HistoryTimeline({ detail }: { detail: Pick<IncidentDetailDTO, 'history' | 'events'> }) {
  const items = [...detail.history.map(fromHistory), ...detail.events.map(fromEvent)]
    .filter((item): item is TimelineItem => item !== null)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <motion.ol variants={stagger(0.04)} initial="hidden" animate="show" className="relative flex flex-col gap-3 pl-1">
      <span className="absolute top-2 bottom-2 left-[15px] w-px bg-line" aria-hidden />
      {items.map((item) => (
        <motion.li key={item.id} variants={fadeUp} className="relative flex gap-3">
          <span className={cn('relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border', TONE[item.tone])}>
            <Icon icon={item.icon} size={13} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{item.title}</span>
              <time className="shrink-0 font-mono text-[11px] text-faint">{timeFormat.format(new Date(item.at))}</time>
            </div>
            {item.detail && <p className="mt-0.5 text-xs text-muted">{item.detail}</p>}
            <div className="mt-0.5 flex gap-3 text-[11px] text-faint">
              {item.actor && <span>{item.actor}</span>}
              {item.duration ? <span className="font-mono">etapa anterior: {formatDuration(item.duration)}</span> : null}
            </div>
          </div>
        </motion.li>
      ))}
    </motion.ol>
  );
}
