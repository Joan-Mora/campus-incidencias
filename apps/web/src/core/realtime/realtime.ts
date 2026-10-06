import { useEffect } from 'react';
import { create } from 'zustand';
import type { RealtimeMessage } from '@campus/shared';
import { wsUrl } from '../api/client';
import { keys, queryClient } from '../api/queryClient';
import { useAuth } from '../auth/store';

type Status = 'idle' | 'connecting' | 'online' | 'offline';

export const useRealtimeStatus = create<{ status: Status; set: (status: Status) => void }>()((set) => ({
  status: 'idle',
  set: (status) => set({ status }),
}));

type Listener = (message: RealtimeMessage) => void;
const listeners = new Set<Listener>();

/** Suscripción a mensajes en vivo para reacciones visuales (destellos, avisos, cámara). */
export function onRealtime(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRealtimeListener(listener: Listener, deps: unknown[] = []) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onRealtime(listener), deps);
}

function invalidateFor(message: RealtimeMessage) {
  switch (message.type) {
    case 'incident.created':
    case 'incident.updated':
    case 'incident.escalated':
    case 'incident.warning':
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: keys.incident(message.payload.incidentId) });
      break;
    case 'suggestion.created':
      queryClient.invalidateQueries({ queryKey: keys.suggestions });
      break;
    case 'dashboard.changed':
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      break;
  }
}

/** Mantiene un WebSocket autenticado con reconexión exponencial mientras haya sesión. */
export function useRealtimeConnection() {
  const token = useAuth((state) => state.token);
  const setStatus = useRealtimeStatus((state) => state.set);

  useEffect(() => {
    if (!token) {
      setStatus('idle');
      return;
    }
    let socket: WebSocket | null = null;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let closed = false;

    const connect = () => {
      setStatus('connecting');
      socket = new WebSocket(wsUrl(token));
      socket.onopen = () => {
        retry = 0;
        setStatus('online');
        pingTimer = setInterval(() => socket?.readyState === WebSocket.OPEN && socket.send('{"type":"ping"}'), 25_000);
        // Al reconectar pueden haberse perdido eventos: se refresca todo lo visible.
        queryClient.invalidateQueries();
      };
      socket.onmessage = (event) => {
        let message: RealtimeMessage;
        try {
          message = JSON.parse(event.data as string) as RealtimeMessage;
        } catch {
          return;
        }
        invalidateFor(message);
        listeners.forEach((listener) => listener(message));
      };
      socket.onclose = (event) => {
        clearInterval(pingTimer);
        if (closed) return;
        if (event.code === 4401) {
          useAuth.getState().logout();
          return;
        }
        setStatus('offline');
        const delay = Math.min(15_000, 1000 * 2 ** retry) + Math.random() * 400;
        retry += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();
    const onOnline = () => {
      if (socket?.readyState !== WebSocket.OPEN) {
        clearTimeout(reconnectTimer);
        retry = 0;
        connect();
      }
    };
    window.addEventListener('online', onOnline);

    return () => {
      closed = true;
      window.removeEventListener('online', onOnline);
      clearTimeout(reconnectTimer);
      clearInterval(pingTimer);
      socket?.close();
    };
  }, [token, setStatus]);
}
