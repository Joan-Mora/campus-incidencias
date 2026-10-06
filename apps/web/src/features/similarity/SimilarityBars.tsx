import { motion } from 'framer-motion';
import { AUTO_GROUP_THRESHOLD, SIMILARITY_WEIGHTS, SUGGEST_THRESHOLD, type SimilarityBreakdown } from '@campus/shared';
import { spring } from '../../core/motion';
import { cn } from '../../ui/cn';
import { formatNumber } from '../../ui/format';

const PARTS: { key: keyof typeof SIMILARITY_WEIGHTS; label: string }[] = [
  { key: 'location', label: 'Ubicación' },
  { key: 'category', label: 'Categoría' },
  { key: 'text', label: 'Texto' },
  { key: 'time', label: 'Tiempo' },
];

/** Desglose de similitud: cada criterio con su peso y el puntaje total contra los umbrales. */
export function SimilarityBars({ breakdown, className }: { breakdown: SimilarityBreakdown; className?: string }) {
  const tone = breakdown.score >= AUTO_GROUP_THRESHOLD ? 'text-level-low' : breakdown.score >= SUGGEST_THRESHOLD ? 'text-level-high' : 'text-muted';
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {PARTS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-2 text-[11px]">
          <span className="w-16 text-muted">{label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface ring-1 ring-line">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(breakdown[key] * 100)}%` }}
              transition={spring.gentle}
            />
          </div>
          <span className="w-[4.5rem] shrink-0 text-right font-mono whitespace-nowrap tabular text-faint">
            {Math.round(breakdown[key] * 100)} x {formatNumber(SIMILARITY_WEIGHTS[key], 2)}
          </span>
        </div>
      ))}
      <div className="mt-0.5 flex items-center justify-between text-[11px]">
        <span className="text-faint">{breakdown.textSource === 'embedding' ? 'Texto por embeddings' : 'Texto por TF-IDF'}</span>
        <span className={cn('font-mono font-semibold tabular', tone)}>{Math.round(breakdown.score * 100)} %</span>
      </div>
    </div>
  );
}
