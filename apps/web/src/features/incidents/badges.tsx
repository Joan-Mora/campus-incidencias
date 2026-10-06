import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  formatDuration,
  type Category,
  type IncidentDTO,
  type IncidentStatus,
  type PriorityLevel,
} from '@campus/shared';
import { LEVEL_STYLES } from '../../core/theme/levels';
import { cn } from '../../ui/cn';
import { Icon } from '../../ui/Icon';
import { CATEGORY_ICONS, LEVEL_ICONS, STATUS_ICONS } from '../../ui/icons';
import { Ring } from '../../ui/Ring';
import { SLA_KIND_LABEL, SLA_STATE_COLOR, slaSnapshot } from './sla';

export function LevelBadge({ level, escalated, className }: { level: PriorityLevel; escalated?: number; className?: string }) {
  const style = LEVEL_STYLES[level];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
        style.text,
        style.soft,
        style.border,
        className,
      )}
    >
      <Icon icon={LEVEL_ICONS[level]} size={12} />
      {PRIORITY_LABELS[level]}
      {escalated ? <span className="font-mono opacity-80">+{escalated}</span> : null}
    </span>
  );
}

const STATUS_TONE: Record<IncidentStatus, string> = {
  PENDING: 'text-muted border-line',
  IN_PROGRESS: 'text-accent border-accent/40 bg-accent/10',
  RESOLVED: 'text-level-low border-level-low/40 bg-level-low/10',
  VERIFIED: 'text-level-low border-level-low/50 bg-level-low/15',
};

export function StatusBadge({ status, className }: { status: IncidentStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', STATUS_TONE[status], className)}>
      <Icon icon={STATUS_ICONS[status]} size={12} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function CategoryTile({ category, level, size = 'md' }: { category: Category; level?: PriorityLevel; size?: 'sm' | 'md' | 'lg' }) {
  const style = level ? LEVEL_STYLES[level] : null;
  const dims = size === 'lg' ? 'h-14 w-14 rounded-2xl' : size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl';
  return (
    <span
      className={cn('grid shrink-0 place-items-center border', dims, style ? cn(style.soft, style.text, style.border) : 'border-line bg-surface text-fg')}
      title={CATEGORY_LABELS[category]}
    >
      <Icon icon={CATEGORY_ICONS[category]} size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'} />
    </span>
  );
}

/** Anillo de SLA que se vacía; late cuando la incidencia ya venció. */
export function SlaRing({ incident, now, size = 34, showLabel }: { incident: IncidentDTO; now: Date; size?: number; showLabel?: boolean }) {
  const sla = slaSnapshot(incident, now);
  const color = SLA_STATE_COLOR[sla.state];
  const label =
    sla.kind === null
      ? 'SLA cumplido'
      : sla.remainingMs >= 0
        ? `${SLA_KIND_LABEL[sla.kind]}: quedan ${formatDuration(sla.remainingMs)}`
        : `${SLA_KIND_LABEL[sla.kind]}: vencido hace ${formatDuration(sla.remainingMs)}`;
  const ring = (
    <Ring value={sla.kind ? 1 - Math.min(1, sla.consumed) : 1} size={size} color={color} pulse={sla.state === 'breach' || incident.isOverdue} label={label}>
      <Icon icon={sla.kind ? (sla.state === 'breach' ? LEVEL_ICONS.CRITICAL : STATUS_ICONS.PENDING) : STATUS_ICONS.VERIFIED} size={size > 40 ? 16 : 12} className="text-muted" />
    </Ring>
  );
  if (!showLabel) return ring;
  return (
    <div className="flex items-center gap-2.5">
      {ring}
      <div className="leading-tight">
        <div className="text-[11px] uppercase tracking-wider text-faint">{sla.kind ? `SLA de ${SLA_KIND_LABEL[sla.kind].toLowerCase()}` : 'SLA'}</div>
        <div className="font-mono text-sm tabular" style={{ color }}>
          {sla.kind === null ? 'Cerrado' : sla.remainingMs >= 0 ? formatDuration(sla.remainingMs) : `-${formatDuration(sla.remainingMs)}`}
        </div>
      </div>
    </div>
  );
}
