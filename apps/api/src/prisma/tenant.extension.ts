import { Prisma } from '@prisma/client';
import { getTenantId, isTenantBypassed } from './tenant-context';

/**
 * Models que possuem a coluna `tenantId` diretamente e DEVEM ser escopados
 * automaticamente. (Extraído do schema: 24 models.)
 *
 * Tabelas de junção sem `tenantId` (GroupMember, MinistryMember, Lesson,
 * CourseEnrollment, Certificate, ChildCheckIn, EventAttendance, FamilyMember,
 * MemberTag) NÃO entram aqui: elas são protegidas pela validação do registro-pai
 * já feita nos services. Models globais (Plan, Tenant, RefreshToken) também não.
 */
const TENANT_SCOPED_MODELS = new Set<string>([
  'AuditLog',
  'Automation',
  'AutomationLog',
  'Campaign',
  'Child',
  'Course',
  'Device',
  'Donation',
  'Event',
  'Family',
  'Group',
  'Member',
  'Message',
  'MessageTemplate',
  'Ministry',
  'NetworkDevice',
  'Note',
  'Notification',
  'Subscription',
  'Tag',
  'Task',
  'User',
  'Visit',
  'Visitor',
]);

// Operações que filtram registros via `where`.
const WHERE_OPS = new Set<string>([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

function withTenantWhere(args: any, tenantId: string): any {
  const next = { ...(args ?? {}) };
  next.where = { ...(next.where ?? {}), tenantId };
  return next;
}

function stampTenantData<T extends Record<string, any>>(data: T, tenantId: string): T {
  // Só injeta se o registro não definiu tenant (escalar ou relação),
  // evitando conflito com `tenant: { connect: ... }`.
  if (data == null) return { tenantId } as unknown as T;
  if (data.tenantId === undefined && data.tenant === undefined) {
    return { ...data, tenantId };
  }
  return data;
}

/**
 * Extensão de "tenant guard".
 *
 * Transforma o isolamento multi-tenant de garantia por disciplina em garantia
 * estrutural: toda query nos models escopados recebe `tenantId` automaticamente,
 * mesmo que o service esqueça de filtrar.
 *
 * Requer Prisma >= 5 (extendedWhereUnique) para aceitar `tenantId` no `where`
 * de `findUnique`/`update`/`delete` junto à chave única.
 *
 * Comportamento quando NÃO há tenant no contexto (login/register/refresh,
 * seed, jobs): a query passa intacta — preserva o fluxo de autenticação.
 */
export function tenantExtension() {
  return Prisma.defineExtension({
    name: 'tenant-guard',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }
          if (isTenantBypassed()) {
            return query(args);
          }
          const tenantId = getTenantId();
          if (!tenantId) {
            return query(args);
          }

          // create / createMany: carimba tenantId nos dados.
          if (operation === 'create') {
            const a = { ...(args ?? {}) } as any;
            a.data = stampTenantData(a.data ?? {}, tenantId);
            return query(a);
          }
          if (operation === 'createMany') {
            const a = { ...(args ?? {}) } as any;
            const rows = Array.isArray(a.data) ? a.data : [a.data];
            a.data = rows.map((r: any) => stampTenantData(r ?? {}, tenantId));
            return query(a);
          }

          // upsert: escopa o where e carimba o create.
          if (operation === 'upsert') {
            const a = withTenantWhere(args, tenantId) as any;
            a.create = stampTenantData(a.create ?? {}, tenantId);
            return query(a);
          }

          // Demais operações baseadas em where.
          if (WHERE_OPS.has(operation)) {
            return query(withTenantWhere(args, tenantId));
          }

          return query(args);
        },
      },
    },
  });
}
