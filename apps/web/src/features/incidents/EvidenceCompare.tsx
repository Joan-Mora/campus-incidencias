import { useRef, useState, type PointerEvent } from 'react';
import { motion } from 'framer-motion';
import type { EvidenceDTO } from '@campus/shared';
import { mediaUrl } from '../../core/api/client';
import { cn } from '../../ui/cn';
import { Icon } from '../../ui/Icon';
import { Icons } from '../../ui/icons';

/** Comparador antes/después: se arrastra el divisor sobre la foto del reporte y la del arreglo. */
export function EvidenceCompare({ before, after, className }: { before: EvidenceDTO; after: EvidenceDTO; className?: string }) {
  const [split, setSplit] = useState(0.5);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const move = (event: PointerEvent) => {
    if (!dragging.current || !box.current) return;
    const rect = box.current.getBoundingClientRect();
    setSplit(Math.max(0.02, Math.min(0.98, (event.clientX - rect.left) / rect.width)));
  };

  return (
    <div
      ref={box}
      className={cn('relative aspect-[4/3] touch-none select-none overflow-hidden rounded-2xl border border-line bg-surface', className)}
      onPointerDown={(event) => {
        dragging.current = true;
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
        move(event);
      }}
      onPointerMove={move}
      onPointerUp={() => (dragging.current = false)}
      role="slider"
      aria-label="Comparar antes y después"
      aria-valuenow={Math.round(split * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') setSplit((value) => Math.max(0.02, value - 0.05));
        if (event.key === 'ArrowRight') setSplit((value) => Math.min(0.98, value + 0.05));
      }}
    >
      <img src={mediaUrl(after.url) ?? ''} alt="Después del arreglo" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split * 100}% 0 0)` }}>
        <img src={mediaUrl(before.url) ?? ''} alt="Antes, al reportar" className="h-full w-full object-cover" draggable={false} />
      </div>
      <div className="absolute inset-y-0" style={{ left: `${split * 100}%` }}>
        <div className="absolute inset-y-0 -left-px w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.5)]" />
        <motion.div
          whileHover={{ scale: 1.08 }}
          className="absolute top-1/2 -left-5 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white text-[#0b1222] shadow-lg"
        >
          <Icon icon={Icons.grip} size="sm" className="rotate-90" />
        </motion.div>
      </div>
      <span className="glass absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold">Antes</span>
      <span className="glass absolute top-3 right-3 rounded-full px-2.5 py-1 text-[11px] font-semibold">Después</span>
    </div>
  );
}

export function EvidenceGrid({ evidence, onOpen }: { evidence: EvidenceDTO[]; onOpen?: (item: EvidenceDTO) => void }) {
  const photos = evidence.filter((item) => item.kind === 'PHOTO' && item.url);
  if (!photos.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((item) => (
        <button
          key={item.id}
          onClick={() => onOpen?.(item)}
          className="group relative aspect-square overflow-hidden rounded-xl border border-line"
        >
          <img src={mediaUrl(item.url) ?? ''} alt={item.stage === 'FIX' ? 'Evidencia del arreglo' : 'Evidencia del reporte'} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
          <span className="glass absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium">
            {item.stage === 'FIX' ? 'Arreglo' : 'Reporte'}
          </span>
        </button>
      ))}
    </div>
  );
}
