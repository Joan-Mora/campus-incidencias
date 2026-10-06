import { useEffect, useRef } from 'react';
import { BrowserQRCodeSvgWriter } from '@zxing/browser';
import { cn } from './cn';

/** Código QR en SVG; hereda el color del texto para verse bien en ambos temas. */
export function QrCode({ value, size = 160, className }: { value: string; size?: number; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const svg = new BrowserQRCodeSvgWriter().write(value, size, size);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Código QR');
    svg.querySelectorAll('rect').forEach((rect) => rect.setAttribute('fill', 'currentColor'));
    node.replaceChildren(svg);
  }, [value, size]);
  return <div ref={host} className={cn('inline-block rounded-2xl bg-white p-3 text-[#0b1020]', className)} style={{ width: size + 24, height: size + 24 }} />;
}
