import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';
import { Icon } from './Icon';
import type { LucideIcon } from './icons';

export function Panel({ className, strong, ...props }: HTMLAttributes<HTMLDivElement> & { strong?: boolean }) {
  return <div className={cn(strong ? 'glass-strong' : 'glass', 'rounded-2xl', className)} {...props} />;
}

export function PanelHeader({
  icon,
  title,
  subtitle,
  actions,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 px-4 pt-4 pb-3', className)}>
      {icon && (
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/12 text-accent">
          <Icon icon={icon} size="sm" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-sm font-semibold tracking-tight">{title}</h3>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
