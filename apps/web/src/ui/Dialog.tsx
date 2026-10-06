import type { ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { fadeIn, scaleIn } from '../core/motion';
import { cn } from './cn';
import { Icon } from './Icon';
import { Icons } from './icons';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onOpenChange, title, description, children, className }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild forceMount>
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="show"
                exit="exit"
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content asChild forceMount>
              <motion.div
                variants={scaleIn}
                initial="hidden"
                animate="show"
                exit="exit"
                className={cn(
                  'glass-strong fixed top-1/2 left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6',
                  className,
                )}
              >
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex-1">
                    <RadixDialog.Title className="font-display text-lg font-semibold">{title}</RadixDialog.Title>
                    {description ? (
                      <RadixDialog.Description className="mt-1 text-sm text-muted">{description}</RadixDialog.Description>
                    ) : (
                      <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
                    )}
                  </div>
                  <RadixDialog.Close className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-fg" aria-label="Cerrar">
                    <Icon icon={Icons.close} size="sm" />
                  </RadixDialog.Close>
                </div>
                {children}
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  );
}
