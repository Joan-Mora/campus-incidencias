import { motion } from 'framer-motion';
import { STATUS_FLOW, STATUS_LABELS, type IncidentStatus } from '@campus/shared';
import { spring } from '../../core/motion';
import { cn } from '../../ui/cn';
import { Icon } from '../../ui/Icon';
import { STATUS_ICONS } from '../../ui/icons';

/** Pendiente, En proceso, Resuelto, Verificado: los pasos cumplidos se llenan con el acento. */
export function StatusProgress({ status, compact = false }: { status: IncidentStatus; compact?: boolean }) {
  const current = STATUS_FLOW.indexOf(status);
  return (
    <div className="flex items-center">
      {STATUS_FLOW.map((step, index) => {
        const done = index <= current;
        return (
          <div key={step} className={cn('flex items-center', index < STATUS_FLOW.length - 1 && 'flex-1')}>
            <div className="flex flex-col items-center gap-1">
              <motion.span
                initial={false}
                animate={{ scale: index === current ? 1.08 : 1 }}
                transition={spring.snappy}
                className={cn(
                  'grid place-items-center rounded-full border transition-colors',
                  compact ? 'h-6 w-6' : 'h-8 w-8',
                  done ? 'border-accent bg-accent text-accent-contrast' : 'border-line bg-surface text-faint',
                  index === current && 'shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_22%,transparent)]',
                )}
              >
                <Icon icon={STATUS_ICONS[step]} size={compact ? 12 : 14} />
              </motion.span>
              {!compact && <span className={cn('text-[10px]', done ? 'text-fg' : 'text-faint')}>{STATUS_LABELS[step]}</span>}
            </div>
            {index < STATUS_FLOW.length - 1 && (
              <div className={cn('relative mx-1 h-0.5 flex-1 overflow-hidden rounded-full bg-line', !compact && 'mb-4')}>
                <motion.span
                  className="absolute inset-y-0 left-0 bg-accent"
                  initial={false}
                  animate={{ width: index < current ? '100%' : '0%' }}
                  transition={spring.gentle}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
