import { motion } from 'framer-motion';
import { CATEGORY_LABELS, PRIORITY_LABELS, RISK_LABELS } from '@campus/shared';
import { listItem, stagger } from '../../core/motion';
import { levelVar } from '../../core/theme/levels';
import { PriorityBreakdown } from '../../features/priority/PriorityBreakdown';
import { Gauge } from '../../ui/Gauge';
import { Icon } from '../../ui/Icon';
import { CATEGORY_ICONS, Icons, RISK_ICONS, type LucideIcon } from '../../ui/icons';
import { Skeleton } from '../../ui/Skeleton';
import { useDraft } from './draftStore';
import { useDraftPreview } from './StepDetail';

function formatHours(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} días`;
}

export function StepConfirm() {
  const draft = useDraft();
  const preview = useDraftPreview();
  const data = preview.data;

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="flex flex-col gap-4">
      <motion.div variants={listItem} className="glass flex flex-col items-center rounded-3xl p-5">
        {data ? (
          <>
            <Gauge value={data.score} size={230} color={levelVar(data.level)} label={`Prioridad ${PRIORITY_LABELS[data.level]}`} caption="de 100 puntos" />
            <div className="mt-4 grid w-full grid-cols-2 gap-2">
              <SlaBox icon={Icons.timer} label="Primera respuesta" value={formatHours(data.responseHours)} />
              <SlaBox icon={Icons.fix} label="Resolución" value={formatHours(data.resolutionHours)} />
            </div>
          </>
        ) : (
          <Skeleton className="h-52 w-full" />
        )}
      </motion.div>

      {data && (
        <motion.div variants={listItem} className="glass rounded-3xl p-4">
          <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Por qué esta prioridad</p>
          <PriorityBreakdown breakdown={data.breakdown} score={data.score} />
        </motion.div>
      )}

      <motion.div variants={listItem} className="glass flex flex-col divide-y divide-line rounded-3xl">
        <Row icon={Icons.pin} label="Lugar" value={draft.space ? `${draft.space.name}, ${draft.space.block.name}` : ''} />
        <Row icon={Icons.crosshair} label="Punto exacto" value={draft.hotspot ? 'Marcado en el salón 3D' : 'Sin marcar'} />
        {draft.category && <Row icon={CATEGORY_ICONS[draft.category]} label="Tipo" value={CATEGORY_LABELS[draft.category]} />}
        <Row icon={RISK_ICONS[draft.riskLevel]} label="Riesgo" value={RISK_LABELS[draft.riskLevel]} />
        <Row icon={Icons.camera} label="Foto" value={draft.photo ? 'Adjunta' : 'Sin foto'} />
        {draft.join && <Row icon={Icons.merge} label="Se suma a" value={draft.join.code} />}
      </motion.div>

      <motion.p variants={listItem} className="rounded-2xl bg-surface p-4 text-sm leading-relaxed text-muted">
        {draft.description}
      </motion.p>
    </motion.div>
  );
}

function SlaBox({ icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted">
        <Icon icon={icon} size={12} />
        {label}
      </div>
      <p className="mt-0.5 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}

function Row({ icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon icon={icon} size="sm" className="text-accent" />
      <span className="text-sm text-muted">{label}</span>
      <span className="ml-auto truncate pl-3 text-right text-sm font-medium">{value}</span>
    </div>
  );
}
