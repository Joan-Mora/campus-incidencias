import { motion } from 'framer-motion';
import type { IncidentDTO } from '@campus/shared';
import { duration, ease, fadeUp, spring, stagger } from '../../core/motion';
import { LevelBadge } from '../../features/incidents/badges';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Icons } from '../../ui/icons';

/** Cierre del asistente: enviado al servidor o guardado en la cola sin conexión. */
export function ReportDone({ incident, queued, onAnother, onTrack }: { incident: IncidentDTO | null; queued: boolean; onAnother: () => void; onTrack: () => void }) {
  return (
    <motion.div variants={stagger(0.08, 0.2)} initial="hidden" animate="show" className="flex min-h-[70dvh] flex-col items-center justify-center text-center">
      <motion.div variants={fadeUp} className="relative mb-6 grid h-32 w-32 place-items-center">
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: queued ? 'var(--level-high)' : 'var(--level-low)' }}
          initial={{ scale: 0.6, opacity: 0.5 }}
          animate={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: duration.scene, ease: ease.out, repeat: 2 }}
        />
        <svg viewBox="0 0 120 120" className="absolute inset-0">
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={queued ? 'var(--level-high)' : 'var(--level-low)'}
            strokeWidth="6"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: duration.scene, ease: ease.out }}
          />
        </svg>
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring.bouncy, delay: duration.slow }} style={{ color: queued ? 'var(--level-high)' : 'var(--level-low)' }}>
          <Icon icon={queued ? Icons.cloudOff : Icons.check} size={52} />
        </motion.span>
      </motion.div>

      <motion.h2 variants={fadeUp} className="font-display text-3xl font-semibold">
        {queued ? 'Guardado sin conexión' : 'Reporte enviado'}
      </motion.h2>
      <motion.p variants={fadeUp} className="mt-2 max-w-xs text-muted">
        {queued
          ? 'Lo enviaremos solo apenas vuelva la señal. No cierres la sesión.'
          : incident?.clusterId && !incident.isClusterPrimary
            ? 'Te sumaste a un reporte existente. Te avisaremos cuando quede resuelto.'
            : 'Ya aparece en el campus del centro de mando. Te avisaremos cada cambio.'}
      </motion.p>
      {incident && (
        <motion.div variants={fadeUp} className="glass mt-6 flex items-center gap-3 rounded-2xl px-4 py-3">
          <span className="font-mono text-lg font-semibold">{incident.code}</span>
          <LevelBadge level={incident.priorityLevel} />
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="mt-10 flex w-full flex-col gap-2">
        {!queued && (
          <Button variant="primary" size="lg" icon={Icons.history} onClick={onTrack}>
            Seguir mi reporte
          </Button>
        )}
        <Button variant="ghost" size="lg" icon={Icons.plus} onClick={onAnother}>
          Reportar otro daño
        </Button>
      </motion.div>
    </motion.div>
  );
}
