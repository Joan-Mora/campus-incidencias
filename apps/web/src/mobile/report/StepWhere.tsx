import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { normalizeText, SPACE_TYPE_LABELS, type SpaceRefDTO } from '@campus/shared';
import { haptic } from '../../core/device/viewMode';
import { listItem, stagger } from '../../core/motion';
import { fetchSpaceByQr, parseQrPayload, toSpaceRef, useCampusTree, useSpaceIndex } from '../../features/locations/api';
import { cn } from '../../ui/cn';
import { Icon } from '../../ui/Icon';
import { Icons, SPACE_ICONS } from '../../ui/icons';
import { Skeleton } from '../../ui/Skeleton';
import { useDraft } from './draftStore';
import { QrScanner } from './QrScanner';

export function StepWhere() {
  const { space, setSpace, next } = useDraft();
  const campuses = useCampusTree();
  const index = useSpaceIndex();
  const [scanning, setScanning] = useState(false);
  const [query, setQuery] = useState('');
  const [campusId, setCampusId] = useState<string | null>(space?.campus.id ?? null);
  const [blockId, setBlockId] = useState<string | null>(space?.block.id ?? null);

  const choose = useCallback(
    (ref: SpaceRefDTO) => {
      haptic();
      setSpace(ref);
      setTimeout(next, 180);
    },
    [setSpace, next],
  );

  const onScan = useCallback(
    async (raw: string) => {
      setScanning(false);
      const token = parseQrPayload(raw);
      if (!token) return toast.error('Ese código no corresponde a un salón del campus');
      try {
        choose(await fetchSpaceByQr(token));
      } catch (error) {
        toast.error((error as Error).message);
      }
    },
    [choose],
  );

  const campus = campuses.data?.find((item) => item.id === campusId) ?? campuses.data?.[0];
  const block = campus?.blocks.find((item) => item.id === blockId) ?? null;

  const results = useMemo(() => {
    const term = normalizeText(query);
    if (term.length < 2) return [];
    return [...index.values()]
      .filter(({ space: item, block: parent }) => normalizeText(`${item.name} ${item.code} ${parent.name}`).includes(term))
      .slice(0, 12);
  }, [query, index]);

  const floors = useMemo(() => {
    if (!block) return [];
    const map = new Map<number, typeof block.spaces>();
    for (const item of block.spaces) map.set(item.floor, [...(map.get(item.floor) ?? []), item]);
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [block]);

  return (
    <div className="flex flex-col gap-5">
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setScanning(true)}
        className="relative flex items-center gap-4 overflow-hidden rounded-3xl bg-accent p-5 text-left text-accent-contrast shadow-[0_18px_40px_-18px_var(--accent)]"
      >
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-black/15">
          <Icon icon={Icons.scan} size={28} />
        </span>
        <span className="flex-1">
          <span className="block font-display text-lg font-semibold">Escanear QR del salón</span>
          <span className="block text-sm opacity-80">Está en la puerta de cada espacio</span>
        </span>
        <span className="pointer-events-none absolute -right-6 -bottom-8 h-28 w-28 rounded-full bg-white/15 blur-xl" />
      </motion.button>

      <div className="glass flex h-12 items-center gap-2 rounded-2xl px-4">
        <Icon icon={Icons.search} size="sm" className="text-faint" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar salón, laboratorio o baño" className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" />
        {query && (
          <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda" className="text-faint">
            <Icon icon={Icons.close} size="sm" />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {query.trim().length >= 2 ? (
          <motion.div key="results" variants={stagger(0.03)} initial="hidden" animate="show" exit={{ opacity: 0 }} className="flex flex-col gap-2">
            {results.length === 0 && <p className="py-6 text-center text-sm text-muted">No encontramos ese espacio</p>}
            {results.map((entry) => (
              <SpaceRow key={entry.space.id} name={entry.space.name} meta={`${entry.block.name}, piso ${entry.space.floor}`} type={entry.space.type} selected={space?.id === entry.space.id} onClick={() => choose(toSpaceRef(entry))} />
            ))}
          </motion.div>
        ) : campuses.isLoading ? (
          <Skeleton key="loading" className="h-48 w-full rounded-3xl" />
        ) : (
          <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
            {(campuses.data?.length ?? 0) > 1 && (
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                {campuses.data!.map((item) => (
                  <Chip
                    key={item.id}
                    active={item.id === campus?.id}
                    onClick={() => {
                      setCampusId(item.id);
                      setBlockId(null);
                    }}
                  >
                    {item.name}
                  </Chip>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {campus?.blocks.map((item) => (
                <motion.button
                  key={item.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setBlockId(item.id === blockId ? null : item.id)}
                  className={cn('flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors', item.id === blockId ? 'border-accent bg-accent/12' : 'glass border-transparent')}
                >
                  <span className={cn('grid h-10 w-10 place-items-center rounded-xl', item.id === blockId ? 'bg-accent text-accent-contrast' : 'bg-surface text-muted')}>
                    <Icon icon={Icons.block} size="sm" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{item.name.split('·')[0].trim()}</span>
                    <span className="block text-[11px] text-muted">
                      {item.floors} pisos, {item.spaces.length} espacios
                    </span>
                  </span>
                </motion.button>
              ))}
            </div>
            <AnimatePresence>
              {block && (
                <motion.div key={block.id} variants={stagger(0.03)} initial="hidden" animate="show" exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-4">
                  {floors.map(([floor, spaces]) => (
                    <div key={floor}>
                      <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-faint uppercase">Piso {floor}</p>
                      <div className="flex flex-col gap-2">
                        {spaces.map((item) => (
                          <SpaceRow
                            key={item.id}
                            name={item.name}
                            meta={`${SPACE_TYPE_LABELS[item.type]}, ${item.capacity} personas`}
                            type={item.type}
                            selected={space?.id === item.id}
                            onClick={() => choose(toSpaceRef({ space: item, block, campus: campus! }))}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {scanning && <QrScanner onResult={onScan} onClose={() => setScanning(false)} />}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn('shrink-0 rounded-full border px-3.5 py-2 text-sm whitespace-nowrap transition-colors', active ? 'border-accent bg-accent/15 text-fg' : 'border-line text-muted')}>
      {children}
    </button>
  );
}

function SpaceRow({ name, meta, type, selected, onClick }: { name: string; meta: string; type: keyof typeof SPACE_ICONS; selected: boolean; onClick: () => void }) {
  return (
    <motion.button
      variants={listItem}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn('flex items-center gap-3 rounded-2xl border p-3 text-left', selected ? 'border-accent bg-accent/12' : 'glass border-transparent')}
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-accent">
        <Icon icon={SPACE_ICONS[type]} size="sm" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{name}</span>
        <span className="block truncate text-xs text-muted">{meta}</span>
      </span>
      <Icon icon={selected ? Icons.check : Icons.chevronRight} size="sm" className={selected ? 'text-accent' : 'text-faint'} />
    </motion.button>
  );
}
