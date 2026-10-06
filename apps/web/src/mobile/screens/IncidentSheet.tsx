import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import imageCompression from 'browser-image-compression';
import { toast } from 'sonner';
import { CATEGORY_LABELS, type IncidentDetailDTO, type TransitionRule } from '@campus/shared';
import { haptic } from '../../core/device/viewMode';
import { fadeUp } from '../../core/motion';
import { useLevelColors } from '../../core/theme/levels';
import { useCurrentUser } from '../../features/auth/api';
import { uploadEvidence, useIncident } from '../../features/incidents/api';
import { CategoryTile, LevelBadge, SlaRing } from '../../features/incidents/badges';
import { EvidenceCompare, EvidenceGrid } from '../../features/incidents/EvidenceCompare';
import { useNow } from '../../features/incidents/sla';
import { HistoryTimeline, StageBar } from '../../features/workflow/HistoryTimeline';
import { StatusProgress } from '../../features/workflow/StatusProgress';
import { useTechnicians, useTransition } from '../../features/workflow/api';
import { celebrate } from '../../features/workflow/celebrate';
import { RoomScene } from '../../scenes/RoomHost';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { Textarea } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Icons } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { useMobileNav } from '../navStore';

export function IncidentSheet() {
  const { openIncidentId, openIncident } = useMobileNav();
  // Conserva la última incidencia mientras la hoja se cierra, para que no parpadee "Cargando".
  const [shownId, setShownId] = useState(openIncidentId);
  useEffect(() => {
    if (openIncidentId) setShownId(openIncidentId);
  }, [openIncidentId]);
  const { data: detail } = useIncident(openIncidentId ?? shownId);
  return (
    <Sheet open={Boolean(openIncidentId)} onOpenChange={(open) => !open && openIncident(null)} title={detail ? `${detail.code}, ${CATEGORY_LABELS[detail.category]}` : 'Cargando'}>
      {detail ? <SheetBody detail={detail} onDone={() => openIncident(null)} /> : <Skeleton className="h-72 w-full" />}
    </Sheet>
  );
}

function SheetBody({ detail, onDone }: { detail: IncidentDetailDTO; onDone: () => void }) {
  const now = useNow(1000);
  const levelColors = useLevelColors();
  const [showHistory, setShowHistory] = useState(false);
  const before = detail.evidence.find((item) => item.kind === 'PHOTO' && item.stage === 'REPORT');
  const after = detail.evidence.find((item) => item.kind === 'PHOTO' && item.stage === 'FIX');
  const fixNote = detail.evidence.find((item) => item.kind === 'TEXT' && item.stage === 'FIX');
  const open = detail.status === 'PENDING' || detail.status === 'IN_PROGRESS';

  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="flex items-start gap-3">
        <CategoryTile category={detail.category} level={detail.priorityLevel} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <LevelBadge level={detail.priorityLevel} escalated={detail.escalationSteps || undefined} />
            {detail.clusterSize > 1 && (
              <span className="flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-[11px] text-accent">
                <Icon icon={Icons.users} size={11} />
                {detail.clusterSize} reportes
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {detail.space.name}, piso {detail.space.floor}, {detail.space.block.name}
          </p>
        </div>
        {open && <SlaRing incident={detail} now={now} size={44} />}
      </div>

      <StatusProgress status={detail.status} />

      <p className="text-[15px] leading-relaxed">{detail.description}</p>

      {detail.hotspot && (
        <div className="h-56 overflow-hidden rounded-3xl border border-line">
          <RoomScene type={detail.space.type} value={detail.hotspot} accent={levelColors[detail.priorityLevel]} />
        </div>
      )}

      {before && after ? <EvidenceCompare before={before} after={after} /> : detail.evidence.some((item) => item.kind === 'PHOTO') && <EvidenceGrid evidence={detail.evidence} />}
      {fixNote && (
        <p className="flex gap-2 rounded-2xl border border-level-low/30 bg-level-low/8 p-3 text-sm">
          <Icon icon={Icons.fix} size="sm" className="mt-0.5 shrink-0 text-level-low" />
          {fixNote.text}
        </p>
      )}

      <Actions detail={detail} onDone={onDone} />

      <button onClick={() => setShowHistory((value) => !value)} className="flex items-center gap-2 py-1 text-sm text-muted">
        <Icon icon={Icons.history} size="sm" />
        {showHistory ? 'Ocultar historia' : 'Ver historia y tiempos'}
        <Icon icon={showHistory ? Icons.chevronUp : Icons.chevronDown} size="sm" className="ml-auto" />
      </button>
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-4 overflow-hidden">
            <StageBar detail={detail} now={now} />
            <HistoryTimeline detail={detail} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Actions({ detail, onDone }: { detail: IncidentDetailDTO; onDone: () => void }) {
  const user = useCurrentUser();
  const transition = useTransition();
  const [active, setActive] = useState<TransitionRule | null>(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needsAssignee = active?.from === 'PENDING' && user?.role === 'SUPERVISOR';
  const technicians = useTechnicians(Boolean(needsAssignee));
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => void (photoUrl && URL.revokeObjectURL(photoUrl)), [photoUrl]);

  useEffect(() => {
    setActive(null);
    setNote('');
    setPhoto(null);
  }, [detail.id]);

  if (!detail.availableTransitions.length) return null;

  const requiresInput = (rule: TransitionRule) => Boolean(rule.requires?.length) || (rule.from === 'PENDING' && user?.role === 'SUPERVISOR');

  const execute = async (rule: TransitionRule) => {
    setBusy(true);
    try {
      if (photo && rule.requires?.includes('fixEvidence')) await uploadEvidence(detail.id, photo, 'FIX');
      await transition.mutateAsync({ incidentId: detail.id, to: rule.to, note: note.trim() || null, assigneeId });
      haptic([12, 60, 24]);
      if (rule.to === 'VERIFIED') celebrate();
      toast.success(`${detail.code}: ${rule.label.toLowerCase()}`);
      onDone();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (active) {
    const fix = active.requires?.includes('fixEvidence');
    const ready = (!active.requires?.includes('note') || note.trim()) && (!fix || photo || note.trim()) && (!needsAssignee || assigneeId);
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex flex-col gap-3 rounded-3xl border border-accent/30 bg-accent/6 p-4">
        <p className="text-sm font-semibold">{active.label}</p>
        {needsAssignee && (
          <div className="flex flex-col gap-2">
            {technicians.data?.map((technician) => (
              <button
                key={technician.id}
                onClick={() => setAssigneeId(technician.id)}
                className={cn('flex items-center gap-3 rounded-2xl border p-3 text-left', assigneeId === technician.id ? 'border-accent bg-accent/12' : 'border-line bg-surface')}
              >
                <Icon icon={Icons.wrench} size="sm" className="text-accent" />
                <span className="flex-1 text-sm font-medium">{technician.name}</span>
                <span className="text-xs text-muted">{technician.openAssigned} en curso</span>
              </button>
            ))}
          </div>
        )}
        {fix && (
          <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-line-strong p-3">
            {photoUrl ? <img src={photoUrl} alt="Evidencia del arreglo" className="h-14 w-14 rounded-xl object-cover" /> : (
              <span className="grid h-14 w-14 place-items-center rounded-xl bg-accent/12 text-accent">
                <Icon icon={Icons.camera} />
              </span>
            )}
            <span className="flex-1 text-sm">{photo ? 'Foto del arreglo lista' : 'Foto del después'}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const compressed = await imageCompression(file, { maxSizeMB: 0.7, maxWidthOrHeight: 1600, useWebWorker: true, fileType: 'image/jpeg' });
                setPhoto(new File([compressed], 'arreglo.jpg', { type: 'image/jpeg' }));
              }}
            />
          </label>
        )}
        {(fix || active.requires?.includes('note')) && (
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={fix ? 'Qué se hizo' : 'Qué sigue fallando'} className="min-h-24" />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setActive(null)}>
            Cancelar
          </Button>
          <Button variant={active.to === 'VERIFIED' ? 'success' : 'primary'} className="flex-[2]" disabled={!ready} loading={busy} onClick={() => execute(active)}>
            {active.label}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {detail.availableTransitions.map((rule) => (
        <Button
          key={rule.to}
          size="lg"
          variant={rule.to === 'VERIFIED' ? 'success' : rule.from === 'RESOLVED' ? 'secondary' : 'primary'}
          icon={rule.to === 'VERIFIED' ? Icons.checkAll : rule.from === 'RESOLVED' ? Icons.reopen : rule.to === 'RESOLVED' ? Icons.fix : Icons.wrench}
          loading={busy}
          onClick={() => (requiresInput(rule) ? setActive(rule) : execute(rule))}
        >
          {rule.to === 'VERIFIED' ? 'Sí, quedó bien' : rule.from === 'RESOLVED' ? 'No quedó bien, reabrir' : rule.label}
        </Button>
      ))}
    </div>
  );
}
