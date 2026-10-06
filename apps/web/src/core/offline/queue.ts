import { useEffect, useSyncExternalStore } from 'react';
import type { CreateIncidentInput, IncidentDTO } from '@campus/shared';
import { api, ApiError } from '../api/client';
import { queryClient } from '../api/queryClient';

/** Reporte guardado sin conexión, con su foto como Blob, para enviarlo al volver la red. */
export interface QueuedReport {
  id: string;
  payload: CreateIncidentInput;
  photo: Blob | null;
  spaceLabel: string;
  createdAt: number;
}

const DB_NAME = 'campus-offline';
const STORE = 'reports';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}

let snapshot: QueuedReport[] = [];
const subscribers = new Set<() => void>();

async function refresh() {
  snapshot = ((await withStore('readonly', (store) => store.getAll())) as QueuedReport[]).sort((a, b) => a.createdAt - b.createdAt);
  subscribers.forEach((notify) => notify());
}

export async function enqueueReport(report: Omit<QueuedReport, 'id' | 'createdAt'>) {
  await withStore('readwrite', (store) => store.put({ ...report, id: crypto.randomUUID(), createdAt: Date.now() }));
  await refresh();
}

let flushing = false;

/** Envía en orden; si un envío falla por red se detiene y reintenta en el próximo evento online. */
export async function flushQueue(): Promise<number> {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    await refresh();
    for (const item of snapshot) {
      try {
        const created = await api<IncidentDTO>('/api/incidents', { body: item.payload });
        if (item.photo) {
          const form = new FormData();
          form.append('file', item.photo, 'evidencia.jpg');
          await api(`/api/incidents/${created.id}/evidence`, { form, query: { stage: 'REPORT' } }).catch(() => undefined);
        }
        await withStore('readwrite', (store) => store.delete(item.id));
        sent += 1;
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          await withStore('readwrite', (store) => store.delete(item.id));
          continue;
        }
        break;
      }
    }
  } finally {
    flushing = false;
    await refresh();
    if (sent > 0) queryClient.invalidateQueries({ queryKey: ['incidents'] });
  }
  return sent;
}

export function useOfflineQueue() {
  return useSyncExternalStore(
    (notify) => {
      subscribers.add(notify);
      return () => subscribers.delete(notify);
    },
    () => snapshot,
  );
}

/** Carga la cola al iniciar y la vacía cada vez que vuelve la conexión. */
export function useOfflineSync(onSent?: (count: number) => void) {
  useEffect(() => {
    const run = () => flushQueue().then((count) => count > 0 && onSent?.(count));
    refresh().then(run);
    window.addEventListener('online', run);
    return () => window.removeEventListener('online', run);
  }, [onSent]);
}

export function useOnline() {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener('online', notify);
      window.addEventListener('offline', notify);
      return () => {
        window.removeEventListener('online', notify);
        window.removeEventListener('offline', notify);
      };
    },
    () => navigator.onLine,
  );
}
