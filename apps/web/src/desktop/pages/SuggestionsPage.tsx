import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { AUTO_GROUP_THRESHOLD, SUGGEST_THRESHOLD, type GroupSuggestionDTO, type IncidentDTO } from '@campus/shared';
import { listItem, stagger, transition } from '../../core/motion';
import { CategoryTile, LevelBadge, StatusBadge } from '../../features/incidents/badges';
import { SimilarityBars } from '../../features/similarity/SimilarityBars';
import { useDecideSuggestion, useSuggestions } from '../../features/similarity/api';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { Icons } from '../../ui/icons';
import { Panel } from '../../ui/Panel';
import { Skeleton } from '../../ui/Skeleton';

const timeFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Bandeja de casos dudosos: similitud entre 55 % y 75 %, la persona decide. */
export default function SuggestionsPage() {
  const query = useSuggestions();
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-5">
        <header>
          <h1 className="font-display text-2xl font-semibold">Posibles duplicados</h1>
          <p className="text-sm text-muted">
            Desde {Math.round(AUTO_GROUP_THRESHOLD * 100)} % de similitud se agrupan solos. Entre {Math.round(SUGGEST_THRESHOLD * 100)} % y{' '}
            {Math.round(AUTO_GROUP_THRESHOLD * 100)} % llegan aquí para que una persona decida.
          </p>
        </header>

        {query.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-56 w-full rounded-3xl" />
            <Skeleton className="h-56 w-full rounded-3xl" />
          </div>
        ) : !query.data?.length ? (
          <EmptyState icon={Icons.merge} illustration="check" title="Sin sugerencias pendientes" description="Cuando lleguen reportes parecidos pero no idénticos aparecerán aquí." className="mt-10" />
        ) : (
          <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {query.data.map((suggestion) => (
                <SuggestionCard key={suggestion.id} suggestion={suggestion} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: GroupSuggestionDTO }) {
  const decide = useDecideSuggestion();
  const run = (decision: 'accept' | 'reject') =>
    decide.mutate(
      { id: suggestion.id, decision },
      {
        onSuccess: () => toast.success(decision === 'accept' ? `${suggestion.incident.code} se unió al grupo de ${suggestion.candidate.code}` : 'Se marcaron como casos distintos'),
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <motion.div layout variants={listItem} exit={{ opacity: 0, x: 60, transition: transition.base }}>
      <Panel className="p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-4">
          <IncidentSide incident={suggestion.incident} caption="Reporte nuevo" />
          <div className="flex flex-col items-center justify-center gap-2">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-accent/30 bg-accent/10 font-mono text-lg font-semibold text-accent">
              {Math.round(suggestion.score * 100)}
            </span>
            <Icon icon={Icons.merge} size="sm" className="text-faint" />
          </div>
          <IncidentSide incident={suggestion.candidate} caption="Caso existente" />
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-6 border-t border-line pt-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
              <Icon icon={Icons.info} size={12} />
              {suggestion.explanation}
            </p>
            <SimilarityBars breakdown={suggestion.breakdown} />
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="primary" icon={Icons.merge} loading={decide.isPending && decide.variables?.decision === 'accept'} onClick={() => run('accept')}>
              Es el mismo daño
            </Button>
            <Button variant="ghost" icon={Icons.unlink} loading={decide.isPending && decide.variables?.decision === 'reject'} onClick={() => run('reject')}>
              Son distintos
            </Button>
          </div>
        </div>
      </Panel>
    </motion.div>
  );
}

function IncidentSide({ incident, caption }: { incident: IncidentDTO; caption: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-faint uppercase">{caption}</p>
      <div className="flex items-start gap-3">
        <CategoryTile category={incident.category} level={incident.priorityLevel} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs text-muted">{incident.code}</span>
            <LevelBadge level={incident.priorityLevel} />
            <StatusBadge status={incident.status} />
          </div>
          <p className="mt-1.5 text-sm leading-relaxed">{incident.description}</p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-faint">
            <Icon icon={Icons.pin} size={11} />
            {incident.space.name}, {incident.space.block.name}
            <span className="ml-auto">{timeFormat.format(new Date(incident.createdAt))}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
