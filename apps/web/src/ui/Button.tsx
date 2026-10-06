import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { spring } from '../core/motion';
import { cn } from './cn';
import { Icon } from './Icon';
import { Icons, type LucideIcon } from './icons';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-contrast shadow-[0_8px_24px_-8px_var(--glow)] hover:bg-accent-strong disabled:shadow-none',
  secondary: 'glass text-fg hover:bg-surface-hover',
  ghost: 'text-muted hover:text-fg hover:bg-surface-hover',
  danger: 'bg-level-critical text-white hover:brightness-110',
  success: 'bg-level-low text-[#04140e] hover:brightness-110',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-13 px-6 text-base gap-2.5 rounded-2xl',
  icon: 'h-10 w-10 rounded-xl',
  'icon-sm': 'h-8 w-8 rounded-lg',
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, loading, disabled, className, children, ...props },
  ref,
) {
  const iconSize = size === 'lg' ? 'lg' : size === 'sm' || size === 'icon-sm' ? 'sm' : 'md';
  return (
    <motion.button
      ref={ref}
      whileTap={disabled || loading ? undefined : { scale: 0.96 }}
      transition={spring.snappy}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center font-medium transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Icon icon={Icons.loader} size={iconSize} className="animate-spin" />
      ) : (
        icon && <Icon icon={icon} size={iconSize} />
      )}
      {children}
      {iconRight && !loading && <Icon icon={iconRight} size={iconSize} />}
    </motion.button>
  );
});
