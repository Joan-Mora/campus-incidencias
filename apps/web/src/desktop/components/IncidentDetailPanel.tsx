import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  CATEGORY_LABELS,
  RISK_LABELS,
  RISK_LEVELS,
  SPACE_TYPE_LABELS,
  explainSimilarity,
  type EvidenceDTO,
  type RiskLevel,
  type TransitionRule,
} from '@campus/shared';
import { fadeUp, spring } from '../../core/motion';
import { levelVar, useLevelColors } from '../../core/theme/levels';
import { useCurrentUser } from '../../features/auth/api';
import { useComment, useCorrectRisk, useIncident } from '../../features/incidents/api';
import { CategoryTile, LevelBadge, SlaRing, StatusBadge } from '../../features/incidents/badges';
import { EvidenceCompare, EvidenceGrid } from '../../features/incidents/EvidenceCompare';
import { useNow } from '../../features/incidents/sla';
import { PriorityBreakdown } from '../../features/priority/PriorityBreakdown';
import { SimilarityBars } from '../../features/similarity/SimilarityBars';
import { useUngroup } from '../../features/similarity/api';
import { HistoryTimeline, StageBar } from '../../features/workflow/HistoryTimeline';
import { useTransition } from '../../features/workflow/api';
import { mediaUrl } from '../../core/api/client';
import { RoomScene } from '../../scenes/RoomHost';
import { useTwin } from '../../scenes/twinStore';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { Dialog } from '../../ui/Dialog';
import { Textarea } from '../../ui/Field';
import { formatNumber } from '../../ui/format';
import { Icon } from '../../ui/Icon';
import { Icons, STATUS_ICONS } from '../../ui/icons';
import { Skeleton } from '../../ui/Skeleton';
import { needsDialog, TransitionDialog } from './TransitionDialog';

const TABS = [
  { value: 'summary', label: 'Resumen' },
  { value: 'history', label: 'Historia' },
  { value: 'cluster', label: 'Grupo' },
] as const;

export function IncidentDetailPanel({ incidentId, onClose }: { incidentId: string; onClose: () => void }) {
  const user = useCurrentUser();
  const { data: detail, isLoading } = useIncident(incidentId);
  const now = useNow(1000);
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('summary');
  const [rule, setRule] = useState<TransitionRule | null>(null);
  const [lightbox, setLightbox] = useState<EvidenceDTO | null>(null);
  const transition = useTransition();
  const select = useTwin((state) => state.select);
  const levelColors = useLevelColors();

  if (isLoading || !detail) {
    return (
      <div className="flex flex-col gap-3 p-5">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const runRule = (next: TransitionRule) => {
    if (needsDialog(next, user?.role)) return setRule(next);
    transition.mutate(
      { incidentId: detail.id, to: next.to },
      { onSuccess: () => toast.success(`${detail.code}: ${next.label.toLowerCase()}`), onError: (error) => toast.error(error.message) },
    );
  };

  const reportPhotos = detail.evidence.filter((item) => item.kind === 'PHOTO' && item.stage === 'REPORT');
  const fixPhotos = detail.evidence.filter((item) => item.kind === 'PHOTO' && item.stage === 'FIX');
  const primaryMember = detail.clusterMembers.find((member) => member.isClusterPrimary);

  return (
    <motion.div key={detail.id} variants={fadeUp} initial="hidden" animate="show" className="flex h-full flex-col">
      <div className="relative overflow-hidden border-b border-line p-5">
        <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl" style={{ background: levelVar(detail.priorityLevel), opacity: 0.18 }} />
        <div className="flex items-start gap-3">
          <CategoryTile category={detail.category} level={detail.priorityLevel} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-xs text-muted">{detail.code}</span>
              <LevelBadge level={detail.priorityLevel} escalated={detail.escalationSteps || undefined} />
              <StatusBadge status={detail.status} />
            </div>
            <h2 className="mt-1 font-display text-lg leading-snug font-semibold">{CATEGORY_LABELS[detail.category]}</h2>
            <p className="text-xs text-muted">
              {detail.space.name}, piso {detail.space.floor}, {detail.space.block.name}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" icon={Icons.close} onClick={onClose} aria-label="Cerrar detalle" />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <SlaRing incident={detail} now={now} size={44} showLabel />
          <div className="flex flex-wrap justify-end gap-2">
            {detail.availableTransitions.map((next) => (
              <Button
                key={next.to}
                size="sm"
                variant={next.to === 'VERIFIED' ? 'success' : next.from === 'RESOLVED' ? 'secondary' : 'primary'}
                icon={next.from === 'RESOLVED' && next.to === 'IN_PROGRESS' ? Icons.reopen : STATUS_ICONS[next.to]}
                loading={transition.isPending}
                onClick={() => runRule(next)}
              >
                {next.label}
              </Button>
            ))}
            {!detail.isClusterPrimary && primaryMember && (
              <Button size="sm" variant="secondary" icon={Icons.merge} onClick={() => select(primaryMember.id)}>
                Ver madre {primaryMember.code}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs.Root value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="flex min-h-0 flex-1 flex-col">
        <Tabs.List className="flex gap-1 border-b border-line px-4">
          {TABS.map((item) => (
            <Tabs.Trigger key={item.value} value={item.value} className="relative px-3 py-2.5 text-sm text-muted transition-colors data-[state=active]:text-fg">
              {item.label}
              {item.value === 'cluster' && detail.clusterSize > 1 && <span className="ml-1 font-mono text-[10px] text-accent">{detail.clusterSize}</span>}
              {tab === item.value && <motion.span layoutId="detail-tab" transition={spring.snappy} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            <motion.div key={tab} variants={fadeUp} initial="hidden" animate="show" exit="exit" className="flex flex-col gap-5">
              {tab === 'summary' && (
                <>
                  <section>
                    <p className="text-sm leading-relaxed">{detail.description}</p>
                    <p className="mt-2 text-xs text-faint">
                      Reportado por {detail.reporter.name}
                      {detail.assignee && `, atiende ${detail.assignee.name}`}
                    </p>
                  </section>

                  {detail.hotspot && (
                    <section>
                      <SectionTitle icon={Icons.crosshair} title="Punto exacto del daño" hint={SPACE_TYPE_LABELS[detail.space.type]} />
                      <div className="h-52 overflow-hidden rounded-2xl border border-line">
                        <RoomScene type={detail.space.type} value={detail.hotspot} accent={levelColors[detail.priorityLevel]} />
                      </div>
                    </section>
                  )}

                  <section>
                    <SectionTitle icon={Icons.gauge} title="Por qué tiene esta prioridad" hint={`${formatNumber(detail.priorityScore)} de 100`} />
                    <PriorityBreakdown breakdown={detail.priorityBreakdown} score={detail.priorityScore} />
                    {user?.role === 'SUPERVISOR' && <RiskCorrection incidentId={detail.id} current={detail.riskLevel} />}
                  </section>

                  {(reportPhotos.length > 0 || fixPhotos.length > 0) && (
                    <section>
                      <SectionTitle icon={Icons.camera} title="Evidencia" />
                      {reportPhotos[0] && fixPhotos[0] ? (
                        <EvidenceCompare before={reportPhotos[0]} after={fixPhotos[0]} />
                      ) : (
                        <EvidenceGrid evidence={detail.evidence} onOpen={setLightbox} />
                      )}
                    </section>
                  )}
                  {detail.evidence
                    .filter((item) => item.kind === 'TEXT' && item.stage === 'FIX')
                    .map((item) => (
                      <div key={item.id} className="flex gap-2.5 rounded-xl border border-level-low/30 bg-level-low/8 p-3 text-sm">
                        <Icon icon={Icons.fix} size="sm" className="mt-0.5 text-level-low" />
                        {item.text}
                      </div>
                    ))}
                  <CommentBox incidentId={detail.id} />
                </>
              )}

              {tab === 'history' && (
                <>
                  <section>
                    <SectionTitle icon={Icons.clock} title="Tiempo en cada etapa" />
                    <StageBar detail={detail} now={now} />
                  </section>
                  <section>
                    <SectionTitle icon={Icons.history} title="Línea de tiempo" />
                    <HistoryTimeline detail={detail} />
                  </section>
                </>
              )}

              {tab === 'cluster' && <ClusterSection detail={detail} canEdit={user?.role === 'SUPERVISOR'} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </Tabs.Root>

      <TransitionDialog incident={rule ? detail : null} rule={rule} onClose={() => setRule(null)} />
      <Dialog open={Boolean(lightbox)} onOpenChange={(open) => !open && setLightbox(null)} title="Evidencia" className="w-[min(92vw,900px)]">
        {lightbox && <img src={mediaUrl(lightbox.url) ?? ''} alt="Evidencia ampliada" className="max-h-[70vh] w-full rounded-2xl object-contain" />}
      </Dialog>
    </motion.div>
  );
}

function SectionTitle({ icon, title, hint }: { icon: typeof Icons.clock; title: string; hint?: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <Icon icon={icon} size="sm" className="text-accent" />
      <h3 className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{title}</h3>
      {hint && <span className="ml-auto font-mono text-xs text-faint">{hint}</span>}
    </div>
  );
}

function RiskCorrection({ incidentId, current }: { incidentId: string; current: RiskLevel }) {
  const correct = useCorrectRisk();
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-[11px] text-faint">Riesgo para las personas</span>
      <div className="ml-auto flex gap-1">
        {RISK_LEVELS.map((level) => (
          <button
            key={level}
            disabled={correct.isPending}
            onClick={() =>
              level !== current &&
              correct.mutate(
                { incidentId, riskLevel: level, note: 'Corrección de supervisión' },
                { onSuccess: () => toast.success('Riesgo corregido, la prioridad se recalculó'), onError: (error) => toast.error(error.message) },
              )
            }
            className={cn(
              'rounded-lg border px-2 py-1 text-[11px] transition-colors',
              level === current ? 'border-accent bg-accent/12 text-accent' : 'border-line text-muted hover:text-fg',
            )}
          >
            {RISK_LABELS[level]}
          </button>
        ))}
      </div>
    </div>
  );
}

function CommentBox({ incidentId }: { incidentId: string }) {
  const [text, setText] = useState('');
  const comment = useComment();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!text.trim()) return;
        comment.mutate({ incidentId, text }, { onSuccess: () => setText(''), onError: (error) => toast.error(error.message) });
      }}
    >
      <Textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Agregar un comentario al historial" className="min-h-20" />
      <Button type="submit" size="sm" icon={Icons.send} loading={comment.isPending} disabled={!text.trim()} className="self-end">
        Comentar
      </Button>
    </form>
  );
}

function ClusterSection({ detail, canEdit }: { detail: NonNullable<ReturnType<typeof useIncident>['data']>; canEdit: boolean }) {
  const ungroup = useUngroup();
  const select = useTwin((state) => state.select);
  if (detail.clusterMembers.length <= 1) {
    return <p className="text-sm text-muted">Este reporte no está agrupado. Si llegan reportes parecidos en el mismo lugar se agruparán solos.</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs text-muted">
        Similitud = 0.35 ubicación + 0.15 categoría + 0.40 texto + 0.10 tiempo. Desde 75 % se agrupa solo; entre 55 % y 75 % queda como sugerencia.
      </p>
      {detail.clusterMembers.map((member) => (
        <div key={member.id} className={cn('rounded-2xl border p-3', member.id === detail.id ? 'border-accent/40 bg-accent/8' : 'border-line bg-surface')}>
          <div className="flex items-center gap-2">
            <button className="font-mono text-xs text-accent hover:underline" onClick={() => select(member.id)}>
              {member.code}
            </button>
            {member.isClusterPrimary && <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">Madre</span>}
            <span className="ml-auto text-[11px] text-faint">{member.reporterName}</span>
            {canEdit && !member.isClusterPrimary && (
              <Button
                size="icon-sm"
                variant="ghost"
                icon={Icons.unlink}
                aria-label="Separar del grupo"
                loading={ungroup.isPending && ungroup.variables === member.id}
                onClick={() => ungroup.mutate(member.id, { onSuccess: () => toast.success(`${member.code} se separó del grupo`), onError: (error) => toast.error(error.message) })}
              />
            )}
          </div>
          <p className="mt-1 text-sm">{member.description}</p>
          {member.similarity && (
            <>
              <p className="mt-1.5 text-[11px] text-muted">{explainSimilarity(member.similarity)}</p>
              <SimilarityBars breakdown={member.similarity} className="mt-2" />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
