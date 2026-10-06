import { motion } from 'framer-motion';
import { CATEGORIES, CATEGORIES_BY_SPACE, CATEGORY_HINTS, CATEGORY_LABELS, RISK_LABELS, RISK_LEVELS, type RiskLevel } from '@campus/shared';
import { haptic } from '../../core/device/viewMode';
import { listItem, spring, stagger } from '../../core/motion';
import { cn } from '../../ui/cn';
import { Icon } from '../../ui/Icon';
import { CATEGORY_ICONS, RISK_ICONS } from '../../ui/icons';
import { useDraft } from './draftStore';

const RISK_COPY: Record<RiskLevel, string> = {
  NONE: 'Solo molesta o se ve mal',
  LOW: 'Incomoda, pero nadie se lastima',
  MEDIUM: 'Alguien podría lastimarse',
  HIGH: 'Peligro inmediato: cables, agua con corriente, caída',
};

const RISK_TONE: Record<RiskLevel, string> = {
  NONE: 'var(--level-low)',
  LOW: 'var(--level-medium)',
  MEDIUM: 'var(--level-high)',
  HIGH: 'var(--level-critical)',
};

export function StepWhat() {
  const { space, category, riskLevel, riskTouched, setCategory, setRisk } = useDraft();
  const likely = space ? CATEGORIES_BY_SPACE[space.type] : [...CATEGORIES];
  const ordered = [...likely, ...CATEGORIES.filter((item) => !likely.includes(item))];

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold">Tipo de daño</h3>
        <motion.div variants={stagger(0.03)} initial="hidden" animate="show" className="grid grid-cols-2 gap-2">
          {ordered.map((item) => {
            const active = item === category;
            return (
              <motion.button
                key={item}
                variants={listItem}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  haptic(8);
                  setCategory(item);
                }}
                className={cn(
                  'relative flex flex-col items-start gap-2 overflow-hidden rounded-2xl border p-3 text-left transition-colors',
                  active ? 'border-accent bg-accent/14' : 'glass border-transparent',
                  !likely.includes(item) && !active && 'opacity-70',
                )}
              >
                <span className={cn('grid h-10 w-10 place-items-center rounded-xl transition-colors', active ? 'bg-accent text-accent-contrast' : 'bg-surface text-accent')}>
                  <Icon icon={CATEGORY_ICONS[item]} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{CATEGORY_LABELS[item]}</span>
                  <span className="block text-[11px] leading-snug text-muted">{CATEGORY_HINTS[item]}</span>
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Riesgo para las personas</h3>
          {category && !riskTouched && <span className="text-[11px] text-faint">Sugerido por el tipo de daño</span>}
        </div>
        <div className="flex flex-col gap-2">
          {RISK_LEVELS.map((level) => {
            const active = level === riskLevel;
            return (
              <motion.button
                key={level}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  haptic(level === 'HIGH' ? [10, 30, 10] : 8);
                  setRisk(level);
                }}
                className={cn('relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left', active ? 'border-transparent' : 'glass border-transparent')}
              >
                {active && (
                  <motion.span
                    layoutId="risk-pill"
                    transition={spring.snappy}
                    className="absolute inset-0 rounded-2xl border-2"
                    style={{ borderColor: RISK_TONE[level], background: `color-mix(in srgb, ${RISK_TONE[level]} 14%, transparent)` }}
                  />
                )}
                <span className="relative grid h-9 w-9 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${RISK_TONE[level]} 18%, transparent)`, color: RISK_TONE[level] }}>
                  <Icon icon={RISK_ICONS[level]} size="sm" />
                </span>
                <span className="relative flex-1">
                  <span className="block text-sm font-semibold">{RISK_LABELS[level]}</span>
                  <span className="block text-xs text-muted">{RISK_COPY[level]}</span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
