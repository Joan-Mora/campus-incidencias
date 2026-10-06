import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';
import { queryClient } from '../core/api/queryClient';
import { useRealtimeConnection } from '../core/realtime/realtime';
import { useResolvedTheme, useThemeSync } from '../core/theme/store';
import { TooltipProvider } from '../ui/Tooltip';

function Runtime() {
  useThemeSync();
  useRealtimeConnection();
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const theme = useResolvedTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <Runtime />
          {children}
          <Toaster
            theme={theme}
            position="top-center"
            toastOptions={{
              classNames: {
                toast: 'glass-strong !rounded-2xl !border-line !text-fg !font-sans',
                description: '!text-muted',
              },
            }}
          />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
