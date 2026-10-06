import { describe, expect, it } from 'vitest';
import { availableTransitions, checkTransition } from './transition-policy';

const student = { id: 's1', role: 'STUDENT' as const };
const otherStudent = { id: 's2', role: 'STUDENT' as const };
const tech = { id: 't1', role: 'TECHNICIAN' as const };
const otherTech = { id: 't2', role: 'TECHNICIAN' as const };
const supervisor = { id: 'sup', role: 'SUPERVISOR' as const };

const pending = { status: 'PENDING' as const, reporterId: 's1', assigneeId: null };
const inProgress = { status: 'IN_PROGRESS' as const, reporterId: 's1', assigneeId: 't1' };
const resolved = { status: 'RESOLVED' as const, reporterId: 's1', assigneeId: 't1' };

describe('política de transiciones', () => {
  it('un estudiante nunca puede marcar Resuelto', () => {
    const result = checkTransition(student, { ...inProgress, assigneeId: 's1' }, 'RESOLVED', { note: 'listo' });
    expect(result.ok).toBe(false);
  });

  it('nadie resuelve un reporte propio', () => {
    const own = { status: 'IN_PROGRESS' as const, reporterId: 't1', assigneeId: 't1' };
    expect(checkTransition(tech, own, 'RESOLVED', { note: 'arreglado' }).ok).toBe(false);
  });

  it('solo el técnico asignado resuelve y necesita evidencia', () => {
    expect(checkTransition(otherTech, inProgress, 'RESOLVED', { note: 'x' }).ok).toBe(false);
    expect(checkTransition(tech, inProgress, 'RESOLVED').ok).toBe(false);
    expect(checkTransition(tech, inProgress, 'RESOLVED', { hasFixEvidence: true }).ok).toBe(true);
  });

  it('técnico o supervisor toman un caso pendiente', () => {
    expect(checkTransition(tech, pending, 'IN_PROGRESS').ok).toBe(true);
    expect(checkTransition(supervisor, pending, 'IN_PROGRESS').ok).toBe(true);
    expect(checkTransition(student, pending, 'IN_PROGRESS').ok).toBe(false);
  });

  it('solo el estudiante reportante o el supervisor verifican', () => {
    expect(checkTransition(student, resolved, 'VERIFIED').ok).toBe(true);
    expect(checkTransition(otherStudent, resolved, 'VERIFIED').ok).toBe(false);
    expect(checkTransition(supervisor, resolved, 'VERIFIED').ok).toBe(true);
    expect(checkTransition(tech, resolved, 'VERIFIED').ok).toBe(false);
  });

  it('reabrir exige nota', () => {
    expect(checkTransition(student, resolved, 'IN_PROGRESS').ok).toBe(false);
    expect(checkTransition(student, resolved, 'IN_PROGRESS', { note: 'sigue goteando' }).ok).toBe(true);
  });

  it('no se puede saltar etapas', () => {
    expect(checkTransition(supervisor, pending, 'VERIFIED').ok).toBe(false);
  });

  it('lista las acciones disponibles por rol', () => {
    expect(availableTransitions(student, resolved).map((r) => r.to)).toEqual(['VERIFIED', 'IN_PROGRESS']);
    expect(availableTransitions(tech, resolved)).toHaveLength(0);
  });
});
