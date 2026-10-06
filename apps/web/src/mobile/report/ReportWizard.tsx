import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import type { CreateIncidentInput, IncidentDTO } from '@campus/shared';
import { ApiError } from '../../core/api/client';
import { haptic } from '../../core/device/viewMode';
import { spring, wizardStep } from '../../core/motion';
import { enqueueReport, useOnline } from '../../core/offline/queue';
import { uploadEvidence, useCreateIncident } from '../../features/incidents/api';
import { fetchSpaceByQr } from '../../features/locations/api';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { Icons } from '../../ui/icons';
import { useMobileNav } from '../navStore';
import { REPORT_STEPS, STEP_TITLES, useDraft } from './draftStore';
import { ReportDone } from './ReportDone';
import { StepConfirm } from './StepConfirm';
import { StepDetail } from './StepDetail';
import { StepSpot } from './StepSpot';
import { StepWhat } from './StepWhat';
import { StepWhere } from './StepWhere';

const STEP_COMPONENTS = { where: StepWhere, spot: StepSpot, what: StepWhat, detail: StepDetail, confirm: StepConfirm };

export function ReportWizard() {
  const draft = useDraft();
  const { pendingQr, setPendingQr, setTab } = useMobileNav();
  const online = useOnline();
  const create = useCreateIncident();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ incident: IncidentDTO | null; queued: boolean } | null>(null);

  useEffect(() => {
    if (!pendingQr) return;
    setPendingQr(null);
    fetchSpaceByQr(pendingQr)
      .then((space) => {
        useDraft.getState().reset();
        useDraft.getState().setSpace(space);
        useDraft.getState().goTo(1);
        toast.success(`Estás en ${space.name}`);
      })
      .catch((error: Error) => toast.error(error.message));
  }, [pendingQr, setPendingQr]);

  const stepKey = REPORT_STEPS[draft.step];
  const Step = STEP_COMPONENTS[stepKey];

  const canContinue =
    (stepKey === 'where' && Boolean(draft.space)) ||
    stepKey === 'spot' ||
    (stepKey === 'what' && Boolean(draft.category)) ||
    (stepKey === 'detail' && draft.description.trim().length >= 8) ||
    stepKey === 'confirm';

  const submit = async () => {
    if (!draft.space || !draft.category) return;
    const payload: CreateIncidentInput = {
      spaceId: draft.space.id,
      category: draft.category,
      riskLevel: draft.riskLevel,
      description: draft.description.trim(),
      hotspot: draft.hotspot,
      joinIncidentId: draft.join?.id ?? null,
    };
    const spaceLabel = `${draft.space.name}, ${draft.space.block.name}`;
    setSubmitting(true);
    try {
      if (!online) {
        await enqueueReport({ payload, photo: draft.photo, spaceLabel });
        setDone({ incident: null, queued: true });
      } else {
        const incident = await create.mutateAsync(payload);
        if (draft.photo) await uploadEvidence(incident.id, draft.photo, 'REPORT').catch(() => toast.error('El reporte se envió, pero la foto no subió'));
        setDone({ incident, queued: false });
      }
      haptic([12, 60, 24]);
    } catch (error) {
      if (!(error instanceof ApiError)) {
        await enqueueReport({ payload, photo: draft.photo, spaceLabel });
        setDone({ incident: null, queued: true });
      } else {
        toast.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="px-5">
        <ReportDone
          incident={done.incident}
          queued={done.queued}
          onAnother={() => {
            draft.reset();
            setDone(null);
          }}
          onTrack={() => {
            draft.reset();
            setDone(null);
            setTab('mine');
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 mb-3 border-b border-line bg-bg/80 px-5 pt-2 pb-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          {draft.step > 0 ? (
            <Button size="icon-sm" variant="ghost" icon={Icons.arrowLeft} onClick={draft.back} aria-label="Paso anterior" />
          ) : (
            <span className="h-7 w-7" />
          )}
          <div className="flex-1 text-center">
            <p className="text-[11px] font-medium tracking-[0.16em] text-faint uppercase">
              Paso {draft.step + 1} de {REPORT_STEPS.length}
            </p>
            <h2 className="font-display text-lg font-semibold">{STEP_TITLES[stepKey]}</h2>
          </div>
          {draft.step > 0 ? <Button size="icon-sm" variant="ghost" icon={Icons.close} onClick={draft.reset} aria-label="Empezar de nuevo" /> : <span className="h-7 w-7" />}
        </div>
        <div className="mt-3 flex gap-1.5">
          {REPORT_STEPS.map((step, index) => (
            <button key={step} onClick={() => index < draft.step && draft.goTo(index)} className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-label={STEP_TITLES[step]}>
              <motion.span className="block h-full rounded-full bg-accent" initial={false} animate={{ width: index <= draft.step ? '100%' : '0%' }} transition={spring.gentle} />
            </button>
          ))}
        </div>
        {draft.space && draft.step > 0 && (
          <p className="mt-2 truncate text-center text-xs text-muted">
            {draft.space.name}, {draft.space.block.name}
          </p>
        )}
      </div>

      <div className="relative flex-1 overflow-x-hidden px-5 pb-32">
        <AnimatePresence mode="wait" custom={draft.direction} initial={false}>
          <motion.div key={stepKey} custom={draft.direction} variants={wizardStep} initial="enter" animate="center" exit="leave">
            <Step />
          </motion.div>
        </AnimatePresence>
      </div>

      {stepKey !== 'where' && (
        <div className="safe-bottom fixed inset-x-0 bottom-[76px] z-20 bg-gradient-to-t from-bg via-bg/90 to-transparent px-5 pt-6 pb-3">
          <Button
            variant="primary"
            size="lg"
            className={cn('w-full', canContinue ? 'shadow-[0_18px_40px_-16px_var(--accent)]' : 'border border-line disabled:bg-bg-elevated disabled:text-faint disabled:opacity-100!')}
            disabled={!canContinue}
            loading={submitting}
            iconRight={stepKey === 'confirm' ? Icons.send : Icons.arrowRight}
            onClick={() => {
              haptic(8);
              if (stepKey === 'confirm') submit();
              else draft.next();
            }}
          >
            {stepKey === 'confirm' ? (online ? (draft.join ? `Sumarme a ${draft.join.code}` : 'Enviar reporte') : 'Guardar y enviar luego') : stepKey === 'spot' && !draft.hotspot ? 'Omitir este paso' : 'Continuar'}
          </Button>
        </div>
      )}
    </div>
  );
}
