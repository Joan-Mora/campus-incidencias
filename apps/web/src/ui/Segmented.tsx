import { useId } from 'react';
import { motion } from 'framer-motion';
import { spring } from '../core/motion';
import { cn } from './cn';
import { Icon } from './Icon';
import type { LucideIcon } from './icons';

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  size?: 'sm' | 'md';
  className?: string;
  iconOnly?: boolean;
}

/** Control segmentado con una píldora que se desliza entre opciones. */
export function Segmented<T extends string>({ value, onChange, options, size = 'md', className, iconOnly }: SegmentedProps<T>) {
  const id = useId();
  return (
    <div role="radiogroup" className={cn('glass inline-flex rounded-xl p-1', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={iconOnly ? option.label : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              active ? 'text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {active && (
              <motion.span layoutId={`seg-${id}`} transition={spring.snappy} className="absolute inset-0 rounded-lg bg-surface-hover shadow-sm ring-1 ring-line" />
            )}
            {option.icon && <Icon icon={option.icon} size="sm" className="relative" />}
            {!iconOnly && <span className="relative">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
