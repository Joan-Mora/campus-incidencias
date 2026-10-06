import type { ReactNode } from 'react';
import { Drawer } from 'vaul';
import { cn } from './cn';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** Hoja inferior arrastrable (móvil). */
export function Sheet({ open, onOpenChange, title, description, children, className }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <Drawer.Content
          className={cn(
            'glass-strong fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-[28px] outline-none',
            className,
          )}
        >
          <div className="mx-auto mt-3 mb-2 h-1.5 w-12 shrink-0 rounded-full bg-line-strong" />
          <div className="px-5 pb-2">
            <Drawer.Title className="font-display text-lg font-semibold">{title}</Drawer.Title>
            <Drawer.Description className={description ? 'text-sm text-muted' : 'sr-only'}>{description ?? title}</Drawer.Description>
          </div>
          <div className="safe-bottom overflow-y-auto px-5 pb-4">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
