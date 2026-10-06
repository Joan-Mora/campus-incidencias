import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { IncidentDTO, TransitionRule } from '@campus/shared';
import { useCurrentUser } from '../../features/auth/api';
import { uploadEvidence } from '../../features/incidents/api';
import { celebrate } from '../../features/workflow/celebrate';
import { useTechnicians, useTransition } from '../../features/workflow/api';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { Dialog } from '../../ui/Dialog';
import { FieldLabel, Textarea } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Icons, STATUS_ICONS } from '../../ui/icons';

/** Ejecuta una transición; si la regla pide asignación, nota o evidencia, lo pregunta antes. */
export function TransitionDialog({ incident, rule, onClose }: { incident: IncidentDTO | null; rule: TransitionRule | null; onClose: () => void }) {
  const user = useCurrentUser();
  const transition = useTransition();
  const needsAssignee = rule?.from === 'PENDING' && user?.role === 'SUPERVISOR';
  const technicians = useTechnicians(Boolean(needsAssignee));
  const [note, setNote] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNote('');
    setAssigneeId(null);
    setPhoto(null);
  }, [rule, incident]);

  if (!incident || !rule) return null;

  const needsNote = rule.requires?.includes('note');
  const needsFix = rule.requires?.includes('fixEvidence');
  const canSubmit = (!needsAssignee || assigneeId) && (!needsNote || note.trim()) && (!needsFix || note.trim() || photo);

  const submit = async () => {
    setBusy(true);
    try {
      if (needsFix && photo) await uploadEvidence(incident.id, photo, 'FIX');
      await transition.mutateAsync({ incidentId: incident.id, to: rule.to, note: note.trim() || null, assigneeId });
      if (rule.to === 'VERIFIED') celebrate();
      toast.success(`${incident.code}: ${rule.label.toLowerCase()}`);
      onClose();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={`${rule.label} ${incident.code}`} description={rule.description}>
      <div className="flex flex-col gap-4">
        {needsAssignee && (
          <div>
            <FieldLabel>Técnico responsable</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {(technicians.data ?? []).map((technician) => (
                <button
                  key={technician.id}
                  onClick={() => setAssigneeId(technician.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
                    assigneeId === technician.id ? 'border-accent bg-accent/12' : 'border-line hover:bg-surface-hover',
                  )}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface text-accent">
                    <Icon icon={Icons.wrench} size="sm" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{technician.name}</span>
                    <span className="block text-[11px] text-muted">{technician.openAssigned} en proceso</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {needsFix && (
          <div>
            <FieldLabel hint="Foto o nota, al menos una">Evidencia del arreglo</FieldLabel>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong p-3 transition-colors hover:bg-surface-hover">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent/12 text-accent">
                <Icon icon={photo ? Icons.check : Icons.image} />
              </span>
              <span className="flex-1 text-sm">{photo ? photo.name : 'Adjuntar foto del arreglo'}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
            </label>
          </div>
        )}

        {(needsNote || needsFix || rule.to === 'VERIFIED') && (
          <label>
            <FieldLabel hint={needsNote ? 'Obligatoria' : 'Opcional'}>{needsFix ? 'Qué se hizo' : 'Nota'}</FieldLabel>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={needsFix ? 'Se cambió la luminaria y se probó el circuito' : needsNote ? 'Por qué se reabre' : 'Comentario para el historial'}
            />
          </label>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={rule.to === 'VERIFIED' ? 'success' : 'primary'} icon={STATUS_ICONS[rule.to]} loading={busy} disabled={!canSubmit} onClick={submit}>
            {rule.label}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Si la regla no pide nada, ejecuta directo; si pide algo, abre el diálogo. */
export function needsDialog(rule: TransitionRule, role: string | undefined) {
  return Boolean(rule.requires?.length) || (rule.from === 'PENDING' && role === 'SUPERVISOR') || rule.to === 'VERIFIED';
}
