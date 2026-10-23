import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de tenant carregado por requisição.
 *
 * - `tenantId`: igreja (tenant) dona da requisição atual. Quando ausente
 *   (rotas públicas como login/register/refresh, scripts, jobs), a extensão
 *   do Prisma NÃO injeta escopo — preservando o comportamento atual.
 * - `bypass`: quando `true`, desativa explicitamente o escopo automático
 *   (uso administrativo de plataforma / operações cross-tenant conscientes).
 */
export interface TenantStore {
  tenantId?: string;
  bypass?: boolean;
}

const storage = new AsyncLocalStorage<TenantStore>();

/** Executa `fn` dentro de um contexto de tenant. */
export function runWithTenant<T>(store: TenantStore, fn: () => T): T {
  return storage.run(store, fn);
}

/**
 * Executa `fn` IGNORANDO o escopo automático de tenant.
 * Use com consciência (ex.: painel de plataforma SUPER_ADMIN cross-tenant,
 * rotinas de manutenção). Toda chamada Prisma dentro de `fn` não recebe filtro.
 */
export function runWithoutTenant<T>(fn: () => T): T {
  return storage.run({ bypass: true }, fn);
}

/** Retorna o tenantId do contexto atual, ou `undefined` se não houver. */
export function getTenantId(): string | undefined {
  return storage.getStore()?.tenantId;
}

/** Indica se o escopo automático está desativado para o contexto atual. */
export function isTenantBypassed(): boolean {
  return storage.getStore()?.bypass === true;
}
