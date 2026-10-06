import { EventEmitter } from 'node:events';
import type { DomainEventName, DomainEvents } from '@campus/shared';

type Handler<K extends DomainEventName> = (payload: DomainEvents[K]) => void | Promise<void>;

/**
 * Bus de eventos en memoria. Los manejadores corren después de responder y sus errores
 * se registran sin tumbar al emisor; cambiarlo por una cola no toca el dominio.
 */
class EventBus {
  private emitter = new EventEmitter({ captureRejections: false });
  private logger: { error: (obj: unknown, msg: string) => void } = console;

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  setLogger(logger: { error: (obj: unknown, msg: string) => void }) {
    this.logger = logger;
  }

  on<K extends DomainEventName>(name: K, handler: Handler<K>) {
    this.emitter.on(name, (payload: DomainEvents[K]) => {
      Promise.resolve()
        .then(() => handler(payload))
        .catch((error) => this.logger.error({ err: error, event: name }, 'Fallo en un manejador de eventos'));
    });
  }

  emit<K extends DomainEventName>(name: K, payload: DomainEvents[K]) {
    setImmediate(() => this.emitter.emit(name, payload));
  }
}

export const bus = new EventBus();
