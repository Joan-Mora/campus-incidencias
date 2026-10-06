import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { fadeUp } from '../core/motion';
import { cn } from './cn';
import { Icon } from './Icon';
import type { LucideIcon } from './icons';

type Illustration = 'radar' | 'campus' | 'check';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  illustration?: Illustration;
  className?: string;
}

/** Estado vacío ilustrado con SVG propio recoloreado al acento. */
export function EmptyState({ icon, title, description, action, illustration = 'radar', className }: EmptyStateProps) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}
    >
      <div className="relative mb-5 grid h-36 w-36 place-items-center">
        <IllustrationSvg kind={illustration} />
        <span className="absolute grid h-12 w-12 animate-float place-items-center rounded-2xl glass-strong text-accent">
          <Icon icon={icon} size="lg" />
        </span>
      </div>
      <h4 className="font-display text-base font-semibold">{title}</h4>
      {description && <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

function IllustrationSvg({ kind }: { kind: Illustration }) {
  if (kind === 'campus') {
    return (
      <svg viewBox="0 0 144 144" className="absolute inset-0 text-accent" fill="none">
        <path d="M72 30 124 58 72 86 20 58Z" fill="currentColor" opacity="0.08" />
        <path d="M72 30 124 58 72 86 20 58Z" stroke="currentColor" strokeOpacity="0.35" strokeDasharray="3 5" />
        <path d="M44 62V44l16-8 16 8v18l-16 8Z" stroke="currentColor" strokeOpacity="0.5" />
        <path d="M80 70V58l14-7 14 7v12l-14 7Z" stroke="currentColor" strokeOpacity="0.35" />
        <path d="M72 100 124 72v14L72 114 20 86V72Z" stroke="currentColor" strokeOpacity="0.2" />
      </svg>
    );
  }
  if (kind === 'check') {
    return (
      <svg viewBox="0 0 144 144" className="absolute inset-0 text-level-low" fill="none">
        <circle cx="72" cy="72" r="56" fill="currentColor" opacity="0.06" />
        <circle cx="72" cy="72" r="56" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="2 6" />
        <circle cx="72" cy="72" r="38" stroke="currentColor" strokeOpacity="0.2" />
        <path d="M20 112h104" stroke="currentColor" strokeOpacity="0.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 144 144" className="absolute inset-0 text-accent" fill="none">
      <circle cx="72" cy="72" r="62" stroke="currentColor" strokeOpacity="0.15" />
      <circle cx="72" cy="72" r="44" stroke="currentColor" strokeOpacity="0.22" strokeDasharray="4 6" />
      <circle cx="72" cy="72" r="26" stroke="currentColor" strokeOpacity="0.3" />
      <path d="M72 72 116 30" stroke="currentColor" strokeOpacity="0.4" strokeLinecap="round" />
      <path d="M72 72 116 30A62 62 0 0 1 134 72Z" fill="currentColor" opacity="0.08" />
      <circle cx="108" cy="52" r="3" fill="currentColor" opacity="0.7" />
      <circle cx="40" cy="96" r="2.5" fill="currentColor" opacity="0.45" />
    </svg>
  );
}
