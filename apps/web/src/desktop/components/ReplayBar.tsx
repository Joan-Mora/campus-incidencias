import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OPEN_STATUSES, stateAt } from '@campus/shared';
import { fadeIn } from '../../core/motion';
import { useTimeline } from '../../features/dashboard/api';
import { useTwin } from '../../scenes/twinStore';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { Icon } from '../../ui/Icon';
import { Icons } from '../../ui/icons';

const SPEEDS = [1, 6, 24] as const;
const SAMPLES = 72;
const HOUR = 3_600_000;

const clockFormat = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Repetición de los últimos días: el gemelo se redibuja en el instante del deslizador. */
export function ReplayBar({ range }: { range: { from: number; to: number } | null }) {
  const { replayAt, playing, speed, setReplayAt, setPlaying, setSpeed } = useTwin();
  const timeline = useTimeline(14);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!playing || !range) return;
    let frame = 0;
    const tick = (time: number) => {
      const delta = last.current == null ? 0 : time - last.current;
      last.current = time;
      const current = useTwin.getState().replayAt ?? range.from;
      const next = current + (delta / 1000) * useTwin.getState().speed * HOUR;
      if (next >= Date.now()) {
        setReplayAt(null);
        return;
      }
      setReplayAt(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      last.current = null;
    };
  }, [playing, range, setReplayAt]);

  const curve = useMemo(() => {
    if (!timeline.data || !range) return null;
    const counts: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const at = new Date(range.from + ((range.to - range.from) * i) / (SAMPLES - 1));
      let open = 0;
      for (const item of timeline.data.incidents) {
        const state = stateAt(item, at);
        if (state && OPEN_STATUSES.includes(state.status) && (item.isClusterPrimary || !item.clusterId)) open++;
      }
      counts.push(open);
    }
    const max = Math.max(1, ...counts);
    const points = counts.map((count, i) => `${(i / (SAMPLES - 1)) * 100},${30 - (count / max) * 26}`);
    return `M0,30 L${points.join(' L')} L100,30 Z`;
  }, [timeline.data, range]);

  if (!range) return null;
  const live = replayAt == null;
  const value = replayAt ?? range.to;
  const progress = ((value - range.from) / (range.to - range.from)) * 100;

  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (live) setReplayAt(range.from);
    setPlaying(true);
  };

  return (
    <div className="glass-strong flex items-center gap-3 rounded-2xl p-2 pr-3 shadow-2xl">
      <Button size="icon" variant={playing ? 'secondary' : 'primary'} icon={playing ? Icons.pause : Icons.play} onClick={togglePlay} aria-label={playing ? 'Pausar repetición' : 'Reproducir los últimos días'} />
      <div className="relative h-10 min-w-0 flex-1">
        {curve && (
          <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="replay-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--accent)" stopOpacity="0.45" />
                <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
              <clipPath id="replay-clip">
                <rect x="0" y="0" width={progress} height="30" />
              </clipPath>
            </defs>
            <path d={curve} fill="var(--accent)" opacity="0.1" />
            <path d={curve} fill="url(#replay-fill)" clipPath="url(#replay-clip)" />
          </svg>
        )}
        <input
          type="range"
          aria-label="Instante de la repetición"
          min={range.from}
          max={range.to}
          step={HOUR / 12}
          value={value}
          onChange={(event) => {
            setPlaying(false);
            const next = Number(event.target.value);
            setReplayAt(next >= range.to - HOUR / 6 ? null : next);
          }}
          className="replay-range absolute inset-0 h-full w-full cursor-pointer"
        />
      </div>
      <div className="flex w-36 flex-col items-end">
        <AnimatePresence mode="wait" initial={false}>
          {live ? (
            <motion.span key="live" variants={fadeIn} initial="hidden" animate="show" exit="exit" className="flex items-center gap-1.5 text-xs font-semibold text-level-low">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-level-low opacity-60" />
                <span className="relative h-2 w-2 rounded-full bg-level-low" />
              </span>
              En vivo
            </motion.span>
          ) : (
            <motion.span key="replay" variants={fadeIn} initial="hidden" animate="show" exit="exit" className="flex items-center gap-1.5 text-xs font-semibold text-accent">
              <Icon icon={Icons.history} size={12} />
              Repetición
            </motion.span>
          )}
        </AnimatePresence>
        <span className="tabular font-mono text-[11px] text-muted capitalize">{clockFormat.format(new Date(value))}</span>
      </div>
      <div className="flex items-center gap-0.5 rounded-lg bg-surface p-0.5">
        {SPEEDS.map((option) => (
          <button
            key={option}
            onClick={() => setSpeed(option)}
            className={cn('rounded-md px-1.5 py-1 font-mono text-[10px] transition-colors', speed === option ? 'bg-accent/20 text-accent' : 'text-faint hover:text-fg')}
            title={`${option} h por segundo`}
          >
            {option}h/s
          </button>
        ))}
      </div>
      {!live && (
        <Button size="sm" variant="ghost" icon={Icons.radar} onClick={() => setReplayAt(null)}>
          Volver a vivo
        </Button>
      )}
    </div>
  );
}
