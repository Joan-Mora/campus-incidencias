import { describe, expect, it } from 'vitest';
import { activeSlaKind, computeDueDates, HOUR_MS, slaConsumed, slaState } from './sla';

const start = new Date('2026-10-06T08:00:00Z');

describe('SLA', () => {
  it('calcula respuesta y resolución por nivel', () => {
    const due = computeDueDates(start, 'CRITICAL');
    expect(due.responseDueAt.getTime() - start.getTime()).toBe(HOUR_MS);
    expect(due.resolutionDueAt.getTime() - start.getTime()).toBe(4 * HOUR_MS);
  });

  it('SLA_TIME_SCALE acelera el reloj', () => {
    const due = computeDueDates(start, 'CRITICAL', 60);
    expect(due.resolutionDueAt.getTime() - start.getTime()).toBe(4 * 60_000);
  });

  it('estado ok, aviso al 80 % y vencido', () => {
    const due = new Date(start.getTime() + 10 * HOUR_MS);
    expect(slaState(new Date(start.getTime() + 5 * HOUR_MS), start, due, 'PENDING')).toBe('ok');
    expect(slaState(new Date(start.getTime() + 8 * HOUR_MS), start, due, 'PENDING')).toBe('warning');
    expect(slaState(new Date(start.getTime() + 11 * HOUR_MS), start, due, 'IN_PROGRESS')).toBe('breach');
    expect(slaState(new Date(start.getTime() + 11 * HOUR_MS), start, due, 'RESOLVED')).toBe('done');
    expect(slaConsumed(new Date(start.getTime() + 5 * HOUR_MS), start, due)).toBe(0.5);
  });

  it('el SLA activo depende de la etapa', () => {
    expect(activeSlaKind('PENDING')).toBe('response');
    expect(activeSlaKind('IN_PROGRESS')).toBe('resolution');
    expect(activeSlaKind('VERIFIED')).toBeNull();
  });
});
