import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  correlationId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Carrega o correlation ID pela cadeia de chamadas sem precisar passá-lo de
 * parâmetro em parâmetro. O ID já era gerado e devolvido no header, mas nenhum
 * service o repassava — as colunas `correlationId` de audit_logs e sync_events
 * ficavam sempre nulas, justamente as que serviriam para rastrear uma operação
 * entre os nós.
 */
export const requestContext = {
  run<T>(correlationId: string, callback: () => T): T {
    return storage.run({ correlationId }, callback);
  },

  getCorrelationId(): string | undefined {
    return storage.getStore()?.correlationId;
  },
};
