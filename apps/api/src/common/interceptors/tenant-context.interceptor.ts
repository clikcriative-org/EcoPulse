import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { runWithTenant } from '../../prisma/tenant-context';

/**
 * Interceptor global. Roda DEPOIS dos guards (logo `request.user` já existe,
 * preenchido pela JwtStrategy) e executa todo o handler dentro de um contexto
 * de tenant (AsyncLocalStorage).
 *
 * Em rotas públicas (login/register/refresh) `request.user` é indefinido →
 * o contexto fica sem tenantId → a extensão do Prisma não injeta escopo.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request?.user?.tenantId;

    return new Observable((subscriber) => {
      runWithTenant({ tenantId }, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
