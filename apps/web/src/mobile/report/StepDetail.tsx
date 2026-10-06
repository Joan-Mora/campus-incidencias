import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import imageCompression from 'browser-image-compression';
import { toast } from 'sonner';
import type { Category, DuplicateCandidateDTO } from '@campus/shared';
import { haptic } from '../../core/device/viewMode';
import { duration, fadeUp, scaleIn } from '../../core/motion';
import { usePriorityPreview } from '../../features/incidents/api';
import { CategoryTile, LevelBadge, StatusBadge } from '../../features/incidents/badges';
import { SimilarityBars } from '../../features/similarity/SimilarityBars';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { Textarea } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Icons } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { useSpeech } from '../hooks/useSpeech';
import { useDraft } from './draftStore';

const PLACEHOLDERS: Record<Category, string> = {
  LIGHTING: 'La lámpara del fondo parpadea y a veces se apaga sola',
  ELECTRICAL: 'La toma junto a la ventana echa chispas y huele a quemado',
  FURNITURE: 'La silla de la tercera fila tiene una pata rota',
  STRUCTURAL: 'Hay una grieta en el muro al lado de la puerta',
  COSMETIC: 'La pared del fondo está rayada y con la pintura caída',
  WATER_LEAK: 'Cae agua del techo cerca del tablero y el piso está mojado',
  SANITARY: 'El lavamanos del medio está tapado y se rebosa',
};

export function useDraftPreview() {
  const { space, category, riskLevel, description, hotspot } = useDraft();
  return usePriorityPreview({ spaceId: space?.id, category: category ?? undefined, riskLevel, description, hotspot });
}

export function StepDetail() {
  const { description, setDescription, photo, setPhoto, join, setJoin, category } = useDraft();
  const preview = useDraftPreview();
  const [compressing, setCompressing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const speech = useSpeech((text) => {
    const current = useDraft.getState().description;
    setDescription(`${current}${current && !current.endsWith(' ') ? ' ' : ''}${text}`);
  });

  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => void (photoUrl && URL.revokeObjectURL(photoUrl)), [photoUrl]);

  const duplicates = (preview.data?.duplicates ?? []).filter((item) => item.decision !== 'none');

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setCompressing(true);
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.7, maxWidthOrHeight: 1600, useWebWorker: true, fileType: 'image/jpeg' });
      setPhoto(new File([compressed], 'evidencia.jpg', { type: 'image/jpeg' }));
      haptic(8);
    } catch {
      toast.error('No pudimos procesar la foto');
    } finally {
      setCompressing(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <AnimatePresence>
        {duplicates.length > 0 && !join && (
          <motion.button
            variants={fadeUp}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={() => setSheetOpen(true)}
            className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/12 p-3.5 text-left"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-contrast">
              <Icon icon={Icons.merge} size="sm" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">Parece que ya lo reportaron</span>
              <span className="block text-xs text-muted">
                {duplicates.length === 1 ? 'Un reporte muy parecido' : `${duplicates.length} reportes parecidos`} en este lugar. Sumarte acelera la atención.
              </span>
            </span>
            <Icon icon={Icons.chevronRight} size="sm" className="text-accent" />
          </motion.button>
        )}
        {join && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" exit="exit" className="flex items-center gap-3 rounded-2xl border border-level-low/40 bg-level-low/10 p-3.5">
            <Icon icon={Icons.checkAll} className="text-level-low" />
            <span className="flex-1 text-sm">
              Te sumarás a <span className="font-mono font-semibold">{join.code}</span>. Tu reporte sube su prioridad.
            </span>
            <Button size="sm" variant="ghost" onClick={() => setJoin(null)}>
              Deshacer
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Cuéntanos qué viste</h3>
          <span className={cn('font-mono text-[11px]', description.trim().length < 8 ? 'text-faint' : 'text-level-low')}>{description.trim().length}/1000</span>
        </div>
        <div className="relative">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={1000}
            placeholder={PLACEHOLDERS[category ?? 'LIGHTING']}
            className="min-h-36 pr-16 text-[15px]"
          />
          {speech.supported && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                haptic(10);
                if (speech.listening) speech.stop();
                else speech.start();
              }}
              aria-label={speech.listening ? 'Detener dictado' : 'Dictar con la voz'}
              className={cn('absolute right-3 bottom-3 grid h-12 w-12 place-items-center rounded-2xl transition-colors', speech.listening ? 'bg-level-critical text-white' : 'bg-accent/15 text-accent')}
            >
              {speech.listening && <span className="absolute inset-0 animate-pulse-ring rounded-2xl" style={{ boxShadow: '0 0 0 3px var(--level-critical)' }} />}
              <Icon icon={speech.listening ? Icons.micOff : Icons.mic} />
            </motion.button>
          )}
        </div>
        <AnimatePresence>
          {speech.listening && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 flex items-center gap-2 text-xs text-muted">
              <VoiceBars />
              {speech.interim || 'Escuchando...'}
            </motion.p>
          )}
        </AnimatePresence>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Foto del daño</h3>
        {photoUrl ? (
          <motion.div variants={scaleIn} initial="hidden" animate="show" className="relative overflow-hidden rounded-3xl">
            <img src={photoUrl} alt="Foto del daño" className="aspect-[4/3] w-full object-cover" />
            <div className="absolute inset-x-3 bottom-3 flex justify-between">
              <span className="glass-strong rounded-full px-3 py-1.5 font-mono text-[11px]">{Math.round((photo?.size ?? 0) / 1024)} KB</span>
              <Button size="sm" variant="secondary" icon={Icons.close} onClick={() => setPhoto(null)} className="glass-strong">
                Quitar
              </Button>
            </div>
          </motion.div>
        ) : (
          <label className="flex cursor-pointer items-center gap-4 rounded-3xl border-2 border-dashed border-line-strong p-5 active:bg-surface-hover">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/12 text-accent">
              <Icon icon={compressing ? Icons.loader : Icons.camera} size={26} className={compressing ? 'animate-spin' : ''} />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">{compressing ? 'Optimizando foto...' : 'Tomar foto'}</span>
              <span className="block text-xs text-muted">Opcional, pero ayuda al técnico a llegar preparado</span>
            </span>
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => onPhoto(event.target.files?.[0])} />
          </label>
        )}
      </section>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Reportes parecidos" description="Si es el mismo daño, súmate: no se duplica el trabajo y el caso sube de prioridad.">
        <div className="flex flex-col gap-3 pt-2">
          {duplicates.map((candidate) => (
            <DuplicateCard
              key={candidate.incident.id}
              candidate={candidate}
              onJoin={() => {
                haptic([10, 40, 10]);
                setJoin({ id: candidate.incident.id, code: candidate.incident.code });
                setSheetOpen(false);
              }}
            />
          ))}
          <Button variant="ghost" onClick={() => setSheetOpen(false)}>
            Es un daño distinto
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function DuplicateCard({ candidate, onJoin }: { candidate: DuplicateCandidateDTO; onJoin: () => void }) {
  const { incident } = candidate;
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex items-start gap-3">
        <CategoryTile category={incident.category} level={incident.priorityLevel} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs text-muted">{incident.code}</span>
            <LevelBadge level={incident.priorityLevel} />
            <StatusBadge status={incident.status} />
          </div>
          <p className="mt-1 text-sm">{incident.description}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted">
            <Icon icon={Icons.pin} size={12} />
            {incident.space.name}, piso {incident.space.floor}
          </p>
          <p className="mt-1 text-[11px] text-faint">{candidate.explanation}</p>
        </div>
      </div>
      <SimilarityBars breakdown={candidate.similarity} className="mt-3" />
      <Button variant="primary" icon={Icons.merge} className="mt-3 w-full" onClick={onJoin}>
        Sumarme a este reporte
      </Button>
    </div>
  );
}

function VoiceBars() {
  return (
    <span className="flex h-4 items-end gap-0.5">
      {[0, 1, 2, 3].map((bar) => (
        <motion.span
          key={bar}
          className="w-0.5 rounded-full bg-level-critical"
          animate={{ height: ['30%', '100%', '45%', '80%', '30%'] }}
          transition={{ duration: duration.scene, repeat: Infinity, delay: bar * 0.12 }}
        />
      ))}
    </span>
  );
}
