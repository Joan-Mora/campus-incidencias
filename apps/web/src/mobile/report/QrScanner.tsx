import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { haptic } from '../../core/device/viewMode';
import { duration, ease } from '../../core/motion';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Icons } from '../../ui/icons';

/** Lector de QR con la cámara trasera; si no hay cámara se escribe el código del salón. */
export function QrScanner({ onResult, onClose }: { onResult: (raw: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const done = useRef(false);

  useEffect(() => {
    if (!video.current) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('La cámara necesita una conexión segura (HTTPS). Escribe el código impreso bajo el QR.');
      return;
    }
    let controls: IScannerControls | undefined;
    let cancelled = false;
    new BrowserQRCodeReader()
      .decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, video.current, (result) => {
        if (!result || done.current) return;
        done.current = true;
        haptic([10, 40, 10]);
        controls?.stop();
        onResult(result.getText());
      })
      .then((value) => {
        controls = value;
        if (cancelled) value.stop();
      })
      .catch(() => setError('No pudimos abrir la cámara. Revisa el permiso o escribe el código del salón.'));
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <video ref={video} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,transparent_34%,rgba(0,0,0,0.72)_36%)]" />

      <div className="safe-top relative flex items-center justify-between px-4 pt-3">
        <span className="text-sm font-medium">Escanea el QR del salón</span>
        <Button size="icon" variant="ghost" icon={Icons.close} onClick={onClose} aria-label="Cerrar lector" className="text-white" />
      </div>

      <div className="relative mx-auto mt-[18vh] aspect-square w-[68vw] max-w-[320px]">
        {['top-0 left-0 border-t-4 border-l-4', 'top-0 right-0 border-t-4 border-r-4', 'bottom-0 left-0 border-b-4 border-l-4', 'bottom-0 right-0 border-b-4 border-r-4'].map((corner) => (
          <span key={corner} className={`absolute h-10 w-10 rounded-md border-accent ${corner}`} />
        ))}
        {!error && (
          <motion.span
            className="absolute inset-x-4 h-0.5 rounded-full bg-accent shadow-[0_0_16px_var(--accent)]"
            animate={{ top: ['8%', '92%', '8%'] }}
            transition={{ duration: duration.ambient, repeat: Infinity, ease: ease.gentle }}
          />
        )}
      </div>

      <div className="safe-bottom relative mt-auto flex flex-col gap-3 p-5">
        {error && (
          <p className="flex items-start gap-2 rounded-2xl bg-white/10 p-3 text-sm backdrop-blur">
            <Icon icon={Icons.warning} size="sm" className="mt-0.5 shrink-0 text-level-high" />
            {error}
          </p>
        )}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (manual.trim()) onResult(manual.trim());
          }}
        >
          <Input value={manual} onChange={(event) => setManual(event.target.value)} placeholder="Código bajo el QR, por ejemplo pri-b-201" className="h-12 flex-1 border-white/20 bg-white/10 text-white placeholder:text-white/50" />
          <Button type="submit" size="icon" variant="primary" icon={Icons.arrowRight} aria-label="Usar código" className="h-12 w-12" />
        </form>
      </div>
    </div>
  );
}
