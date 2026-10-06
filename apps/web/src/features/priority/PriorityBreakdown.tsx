import { motion } from 'framer-motion';
import { FACTOR_LABELS, PRIORITY_WEIGHTS, type PriorityBreakdown as Breakdown, type PriorityFactor } from '@campus/shared';
import { spring, stagger, fadeUp } from '../../core/motion';
import { cn } from '../../ui/cn';
import { formatNumber } from '../../ui/format';

const FACTORS = Object.keys(PRIORITY_WEIGHTS) as PriorityFactor[];

/** Opacidades del acento para distinguir factores sin usar los colores reservados a los niveles. */
const FACTOR_SHADE: Record<PriorityFactor, number> = { risk: 1, damageType: 0.78, similar: 0.58, space: 0.42, age: 0.28 };

const LETTER: Record<PriorityFactor, string> = { risk: 'R', damageType: 'T', similar: 'S', space: 'E', age: 'A' };

/** Barra apilada con el aporte de cada variable y su detalle (valor por peso). */
export function PriorityBreakdown({ breakdown, score, compact, className }: { breakdown: Breakdown; score: number; compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface ring-1 ring-line" role="img" aria-label={`Puntaje ${score} de 100`}>
        {FACTORS.map((factor) => (
          <motion.div
            key={factor}
            initial={{ width: 0 }}
            animate={{ width: `${breakdown[factor].contribution}%` }}
            transition={spring.gentle}
            className="h-full border-r border-bg/60 last:border-r-0"
            style={{ background: 'var(--accent)', opacity: FACTOR_SHADE[factor] }}
            title={`${FACTOR_LABELS[factor]}: ${breakdown[factor].contribution}`}
          />
        ))}
      </div>
      {!compact && (
        <motion.ul variants={stagger(0.04)} initial="hidden" animate="show" className="flex flex-col gap-1.5">
          {FACTORS.map((factor) => {
            const item = breakdown[factor];
            return (
              <motion.li key={factor} variants={fadeUp} className="flex items-center gap-2.5 text-xs">
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md font-mono text-[10px] font-bold text-accent-contrast"
                  style={{ background: 'var(--accent)', opacity: Math.max(0.45, FACTOR_SHADE[factor]) }}
                >
                  {LETTER[factor]}
                </span>
                <span className="flex-1 truncate text-muted">{FACTOR_LABELS[factor]}</span>
                <span className="font-mono whitespace-nowrap tabular text-faint">
                  {formatNumber(item.value, Number.isInteger(item.value) ? 0 : 1)} x {formatNumber(item.weight, 2)}
                </span>
                <span className="w-10 text-right font-mono font-semibold tabular">{formatNumber(item.contribution)}</span>
              </motion.li>
            );
          })}
          <li className="mt-1 flex items-center justify-between border-t border-line pt-2 text-xs">
            <span className="font-mono text-faint">P = {FACTORS.map((factor) => `${formatNumber(PRIORITY_WEIGHTS[factor], 2)}${LETTER[factor]}`).join(' + ')}</span>
            <span className="font-mono text-sm font-semibold tabular">{formatNumber(score)}</span>
          </li>
        </motion.ul>
      )}
    </div>
  );
}
