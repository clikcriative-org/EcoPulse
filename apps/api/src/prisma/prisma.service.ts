import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantExtension } from './tenant.extension';

const LIFECYCLE = new Set(['onModuleInit', 'onModuleDestroy', '$connect', '$disconnect']);

/**
 * PrismaService com escopo multi-tenant automático.
 *
 * O client é estendido com `tenantExtension()` (ver tenant.extension.ts).
 * Para que as 130+ chamadas existentes (`this.prisma.member.findMany(...)`)
 * continuem idênticas, retornamos um Proxy:
 *   - acessos a delegates de model e `$transaction` → client ESTENDIDO (com guard);
 *   - `$connect`/`$disconnect`/ciclo de vida → client BASE (mesma engine).
 *
 * Resultado: zero alteração nos services; o isolamento passa a ser estrutural.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();

    const extended = this.$extends(tenantExtension()) as any;

    return new Proxy(this, {
      get: (base, prop, receiver) => {
        if (typeof prop === 'string' && LIFECYCLE.has(prop)) {
          return Reflect.get(base, prop, receiver);
        }
        const value = extended[prop as any];
        if (value === undefined) {
          return Reflect.get(base, prop, receiver);
        }
        return typeof value === 'function' ? value.bind(extended) : value;
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma conectado (tenant-guard ativo)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
