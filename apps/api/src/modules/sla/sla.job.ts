import cron from 'node-cron';
import type { FastifyBaseLogger } from 'fastify';
import { bus } from '../../common/events';
import { env } from '../../common/env';
import { runSlaPass } from './sla.service';

/** Cada minuto en tiempo real; con el reloj acelerado se revisa cada 10 s para que la demo fluya. */
export function startSlaJob(logger: FastifyBaseLogger) {
  const expression = env.SLA_TIME_SCALE > 1 ? '*/10 * * * * *' : '0 * * * * *';
  let running = false;

  const task = cron.schedule(expression, async () => {
    if (running) return;
    running = true;
    try {
      const result = await runSlaPass();
      if (result.breaches || result.warned || result.recomputed) {
        logger.info(result, 'Pasada de SLA');
        bus.emit('SlaPassCompleted', result);
      }
    } catch (error) {
      logger.error({ err: error }, 'Fallo la pasada de SLA');
    } finally {
      running = false;
    }
  });

  logger.info(`Tarea de SLA programada (${expression}), escala del reloj x${env.SLA_TIME_SCALE}`);
  return task;
}
