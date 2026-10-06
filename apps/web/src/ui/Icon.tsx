import type { LucideIcon } from './icons';
import { ICON_SIZE, ICON_STROKE } from './icons';

interface IconProps {
  icon: LucideIcon;
  size?: keyof typeof ICON_SIZE | number;
  className?: string;
  label?: string;
}

export function Icon({ icon: Glyph, size = 'md', className, label }: IconProps) {
  const pixels = typeof size === 'number' ? size : ICON_SIZE[size];
  return (
    <Glyph
      size={pixels}
      strokeWidth={ICON_STROKE}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  );
}
