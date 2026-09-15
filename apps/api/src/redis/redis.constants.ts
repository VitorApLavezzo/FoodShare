// Token em arquivo próprio: se ele morar no módulo, quem injeta o cliente
// (ex.: LeaderLockService) fecha um ciclo de import com o módulo que o provê,
// e o Nest resolve a dependência como undefined em runtime.
export const REDIS_CLIENT = 'REDIS_CLIENT';
