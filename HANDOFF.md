# ════════════════════════════════════════════════════════════════
# ECOPULSE — Documento de Handoff Completo
# Plataforma de Gestão de Igrejas (inspirada no RNO 360)
# ════════════════════════════════════════════════════════════════

## 1. VISÃO GERAL

ECOPULSE é uma plataforma SaaS multi-tenant de gestão completa para igrejas.
O projeto está ~95% construído, com 130+ arquivos, 8 módulos completos (API + Frontend).

**Stack:**
- Monorepo: pnpm + Turborepo
- Backend: NestJS 10, Prisma ORM, PostgreSQL 16
- Frontend: Next.js 14 (App Router), Tailwind CSS, Lucide icons
- Infra: Docker Compose (dev/prod), Nginx, Certbot SSL
- Deploy: Vercel (frontend) + VPS Hostinger (API + DB)
- CI/CD: GitHub Actions

---

## 2. ESTRUTURA DO PROJETO

```
ecopulse/
├── apps/
│   ├── api/                        # NestJS Backend (porta 3000)
│   │   ├── src/
│   │   │   ├── auth/               # JWT + Refresh + RBAC (6 roles)
│   │   │   │   ├── dto/
│   │   │   │   ├── guards/         # jwt-auth.guard, roles.guard
│   │   │   │   ├── strategies/     # jwt.strategy
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.module.ts
│   │   │   │   └── auth.service.ts
│   │   │   ├── common/
│   │   │   │   ├── decorators/     # @CurrentUser, @Roles
│   │   │   │   ├── filters/        # HttpExceptionFilter
│   │   │   │   └── interceptors/   # TransformInterceptor
│   │   │   ├── communication/      # WhatsApp, Email, SMS, Notificações
│   │   │   │   ├── dto/
│   │   │   │   ├── communication.controller.ts
│   │   │   │   ├── communication.module.ts
│   │   │   │   └── communication.service.ts
│   │   │   ├── donations/          # Dízimos, Ofertas, Campanhas
│   │   │   │   ├── dto/
│   │   │   │   ├── donations.controller.ts
│   │   │   │   ├── donations.module.ts
│   │   │   │   └── donations.service.ts
│   │   │   ├── groups/             # Células, Discipulado, Grupos
│   │   │   │   ├── dto/
│   │   │   │   ├── groups.controller.ts
│   │   │   │   ├── groups.module.ts
│   │   │   │   └── groups.service.ts
│   │   │   ├── kids/               # Check-in seguro de crianças
│   │   │   │   ├── dto/
│   │   │   │   ├── kids.controller.ts
│   │   │   │   ├── kids.module.ts
│   │   │   │   └── kids.service.ts
│   │   │   ├── members/            # Gestão de Pessoas
│   │   │   │   ├── dto/
│   │   │   │   ├── members.controller.ts
│   │   │   │   ├── members.module.ts
│   │   │   │   └── members.service.ts
│   │   │   ├── ministries/         # Ministérios & Voluntários
│   │   │   │   ├── dto/
│   │   │   │   ├── ministries.controller.ts
│   │   │   │   ├── ministries.module.ts
│   │   │   │   └── ministries.service.ts
│   │   │   ├── prisma/             # PrismaService (global)
│   │   │   │   ├── prisma.module.ts
│   │   │   │   └── prisma.service.ts
│   │   │   ├── school/             # Cursos, Aulas, Certificados
│   │   │   │   ├── dto/
│   │   │   │   ├── school.controller.ts
│   │   │   │   ├── school.module.ts
│   │   │   │   └── school.service.ts
│   │   │   ├── tenants/            # Multi-tenant management
│   │   │   ├── users/              # User CRUD
│   │   │   ├── app.module.ts       # Root module (importa tudo)
│   │   │   └── main.ts             # Bootstrap (Swagger, CORS, Helmet)
│   │   ├── nest-cli.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                        # Next.js Dashboard (porta 3001)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/         # Login, Register
│   │   │   │   ├── (dashboard)/    # Layout com Sidebar
│   │   │   │   │   ├── page.tsx                    # Dashboard home
│   │   │   │   │   ├── layout.tsx                  # Sidebar + Header
│   │   │   │   │   ├── kids/                       # RNO Kids
│   │   │   │   │   │   ├── page.tsx                # Listagem
│   │   │   │   │   │   ├── cadastro/page.tsx       # Formulário
│   │   │   │   │   │   └── checkin/page.tsx        # Check-in/out
│   │   │   │   │   ├── pessoas/                    # Gestão de Pessoas
│   │   │   │   │   │   ├── page.tsx                # Listagem + stats
│   │   │   │   │   │   ├── cadastro/page.tsx       # Formulário
│   │   │   │   │   │   └── [id]/page.tsx           # Perfil detalhado
│   │   │   │   │   ├── ministerios/                # Ministérios
│   │   │   │   │   │   ├── page.tsx                # Grid cards
│   │   │   │   │   │   ├── cadastro/page.tsx       # Formulário
│   │   │   │   │   │   └── [id]/page.tsx           # Detalhe + voluntários
│   │   │   │   │   ├── grupos/                     # Grupos & Células
│   │   │   │   │   │   ├── page.tsx                # Grid + filtros
│   │   │   │   │   │   ├── cadastro/page.tsx       # Formulário
│   │   │   │   │   │   └── [id]/page.tsx           # Detalhe + membros
│   │   │   │   │   ├── comunicacao/                # Comunicação
│   │   │   │   │   │   ├── page.tsx                # Dashboard msgs
│   │   │   │   │   │   ├── templates/page.tsx      # Templates
│   │   │   │   │   │   └── enviar/page.tsx         # Enviar mensagem
│   │   │   │   │   ├── doacoes/                    # Doações
│   │   │   │   │   │   ├── page.tsx                # Dashboard financeiro
│   │   │   │   │   │   ├── nova/page.tsx           # Nova doação
│   │   │   │   │   │   └── campanhas/page.tsx      # Campanhas
│   │   │   │   │   ├── escola/                     # Escola
│   │   │   │   │   │   ├── page.tsx                # Listagem cursos
│   │   │   │   │   │   ├── novo-curso/page.tsx     # Formulário
│   │   │   │   │   │   └── cursos/[id]/page.tsx    # Detalhe + aulas + alunos
│   │   │   │   │   ├── eventos/page.tsx
│   │   │   │   │   └── configuracoes/page.tsx
│   │   │   │   ├── globals.css
│   │   │   │   └── layout.tsx
│   │   │   ├── lib/
│   │   │   │   ├── api.ts           # Axios + interceptors (JWT refresh)
│   │   │   │   └── utils.ts
│   │   ├── tailwind.config.ts
│   │   ├── next.config.js
│   │   ├── postcss.config.js
│   │   └── package.json
│   │
│   └── portal/                     # Captive Portal Wi-Fi (porta 3002)
│       └── (estrutura básica Next.js)
│
├── packages/
│   └── shared/                     # Types compartilhados
│
├── prisma/
│   ├── schema.prisma               # 30+ models completos
│   └── seed.ts                     # Planos + tenant demo + admin user
│
├── deploy/
│   ├── Dockerfile.api              # Multi-stage build
│   ├── nginx/nginx.conf            # Reverse proxy + SSL
│   └── .env.prod.example           # Template env produção
│
├── scripts/
│   ├── setup.sh                    # Setup local automatizado
│   ├── deploy.sh                   # Deploy produção
│   ├── ssl-setup.sh                # Certificado Let's Encrypt
│   └── vps-setup.sh                # Setup VPS Ubuntu
│
├── .github/workflows/
│   ├── ci.yml                      # Lint + Build em PRs
│   └── deploy-api.yml              # CD automático na main
│
├── docker-compose.yml              # Dev (Postgres + Redis + MailHog)
├── docker-compose.prod.yml         # Produção (API + DB + Redis + Nginx + Certbot)
├── vercel.json                     # Deploy frontend no Vercel
├── turbo.json                      # Turborepo config
├── pnpm-workspace.yaml
├── package.json                    # Root package
├── .env                            # Dev environment
├── .env.example
├── .dockerignore
└── README.md
```

---

## 3. SCHEMA PRISMA — MODELOS (30+)

| Model | Tabela | Descrição |
|-------|--------|-----------|
| Tenant | tenants | Igreja/organização (multi-tenant) |
| Plan | plans | Planos de assinatura (START, ADVANCE, PRO) |
| User | users | Usuários do sistema (login) |
| RefreshToken | refresh_tokens | Tokens de atualização JWT |
| Member | members | Membros da igreja (CRUD completo) |
| Family | families | Famílias |
| FamilyMember | family_members | Relação membro↔família |
| Ministry | ministries | Ministérios (Louvor, Recepção...) |
| MinistryMember | ministry_members | Voluntários com papel e função |
| Group | groups | Células, discipulado, grupos |
| GroupMember | group_members | Participantes do grupo |
| Event | events | Cultos, conferências |
| EventAttendance | event_attendances | Presença em eventos |
| Child | children | Crianças (RNO Kids) |
| ChildCheckIn | child_check_ins | Check-in/out com código segurança |
| Campaign | campaigns | Campanhas de doação com meta |
| Donation | donations | Dízimos, ofertas, contribuições |
| Course | courses | Cursos (Escola) |
| Lesson | lessons | Aulas do curso |
| CourseEnrollment | course_enrollments | Matrículas |
| Certificate | certificates | Certificados gerados |
| Visitor | visitors | Visitantes (Wi-Fi CRM) |
| Visit | visits | Registros de visita |
| Device | devices | Dispositivos MAC |
| Tag | tags | Tags de segmentação |
| MemberTag | member_tags | Tags aplicadas a membros |
| Automation | automations | Regras de automação |
| AutomationLog | automation_logs | Logs de execução |
| MessageTemplate | message_templates | Templates WhatsApp/Email/SMS |
| Message | messages | Mensagens enviadas (queue) |
| Task | tasks | Tarefas internas |
| Note | notes | Anotações pastorais |
| Notification | notifications | Notificações in-app |
| Subscription | subscriptions | Assinatura do tenant |
| NetworkDevice | network_devices | Roteadores Wi-Fi |
| AuditLog | audit_logs | Logs de auditoria |

**Enums:** UserRole, Gender, MaritalStatus, MemberStatus, VisitorStatus, DonationType, PaymentMethod, PaymentStatus, TriggerType, ActionType, VisitSource, MessageStatus, SubscriptionStatus, TaskStatus, NetworkProvider, GroupType, EventType, EnrollmentStatus

---

## 4. API — ENDPOINTS COMPLETOS

### Auth (`/api/v1/auth`)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /auth/register | Registrar tenant + admin |
| POST | /auth/login | Login (retorna JWT + refresh) |
| POST | /auth/refresh | Renovar access token |
| POST | /auth/logout | Revogar refresh token |
| GET | /auth/me | Dados do usuário logado |

### Members (`/api/v1/members`)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /members | Listar (busca, filtros, paginação) |
| GET | /members/stats | Estatísticas |
| GET | /members/birthdays | Aniversariantes do mês |
| GET | /members/:id | Perfil completo com relacionamentos |
| POST | /members | Cadastrar |
| PATCH | /members/:id | Atualizar |
| DELETE | /members/:id | Soft delete (→ INACTIVE) |

### Kids (`/api/v1/kids`)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /kids/children | Listar crianças |
| GET | /kids/children/:id | Detalhes + histórico |
| POST | /kids/children | Cadastrar criança |
| PATCH | /kids/children/:id | Atualizar |
| DELETE | /kids/children/:id | Soft delete |
| POST | /kids/checkin | Check-in (gera código 6 chars) |
| POST | /kids/checkout/:id | Check-out (valida código) |
| GET | /kids/active | Crianças presentes agora |
| GET | /kids/history | Histórico do dia |
| GET | /kids/stats | Estatísticas |

### Ministries (`/api/v1/ministries`)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /ministries | Listar com contagem |
| GET | /ministries/stats | Estatísticas |
| GET | /ministries/:id | Detalhes + voluntários |
| POST | /ministries | Criar |
| PATCH | /ministries/:id | Atualizar |
| DELETE | /ministries/:id | Desativar |
| POST | /ministries/:id/volunteers | Adicionar voluntário |
| PATCH | /ministries/:id/volunteers/:memberId | Atualizar papel |
| DELETE | /ministries/:id/volunteers/:memberId | Remover |

### Groups (`/api/v1/groups`)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /groups | Listar (filtro por tipo) |
| GET | /groups/stats | Estatísticas |
| GET | /groups/:id | Detalhes + membros |
| POST | /groups | Criar |
| PATCH | /groups/:id | Atualizar |
| DELETE | /groups/:id | Desativar |
| POST | /groups/:id/members | Adicionar membro |
| DELETE | /groups/:id/members/:memberId | Remover |

### Communication (`/api/v1/communication`)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /communication/templates | Listar templates |
| GET | /communication/templates/:id | Buscar template |
| POST | /communication/templates | Criar template |
| PATCH | /communication/templates/:id | Atualizar |
| DELETE | /communication/templates/:id | Desativar |
| POST | /communication/send | Enviar mensagem (batch) |
| GET | /communication/messages | Histórico |
| GET | /communication/stats | Estatísticas |
| GET | /communication/notifications | Notificações do user |
| PATCH | /communication/notifications/:id/read | Marcar lida |
| GET | /communication/notifications/unread | Contagem não lidas |

### Donations (`/api/v1/donations`)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /donations | Registrar doação |
| GET | /donations | Listar (filtros tipo/mês/ano) |
| GET | /donations/stats | Estatísticas financeiras |
| GET | /donations/campaigns | Listar campanhas |
| POST | /donations/campaigns | Criar campanha |
| PATCH | /donations/campaigns/:id | Atualizar campanha |

### School (`/api/v1/school`)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /school/courses | Listar cursos |
| GET | /school/courses/:id | Detalhes + aulas + alunos |
| POST | /school/courses | Criar curso |
| PATCH | /school/courses/:id | Atualizar |
| POST | /school/courses/:id/lessons | Adicionar aula |
| DELETE | /school/courses/:courseId/lessons/:lessonId | Remover aula |
| POST | /school/courses/:id/enroll | Matricular aluno |
| DELETE | /school/courses/:id/enroll/:memberId | Cancelar matrícula |
| POST | /school/courses/:id/complete/:memberId | Concluir + certificado |
| GET | /school/stats | Estatísticas |

---

## 5. FRONTEND — PÁGINAS

| Rota | Descrição |
|------|-----------|
| /login | Página de login |
| /register | Cadastro de nova igreja |
| / | Dashboard principal |
| /pessoas | Listagem membros + stats + filtros |
| /pessoas/cadastro | Formulário completo (3 seções) |
| /pessoas/[id] | Perfil com ministérios, grupos, doações, família |
| /kids | Dashboard Kids + listagem crianças |
| /kids/cadastro | Formulário criança + responsável |
| /kids/checkin | Check-in/out com código segurança |
| /ministerios | Grid cards coloridos |
| /ministerios/cadastro | Nome + descrição + cor |
| /ministerios/[id] | Voluntários + modal adicionar |
| /grupos | Grid com filtros por tipo |
| /grupos/cadastro | Formulário grupo/célula |
| /grupos/[id] | Membros + modal adicionar |
| /comunicacao | Dashboard mensagens + stats |
| /comunicacao/templates | CRUD templates + preview |
| /comunicacao/enviar | Envio com busca destinatários |
| /doacoes | Dashboard financeiro + tabela |
| /doacoes/nova | Formulário doação |
| /doacoes/campanhas | Campanhas com barra de progresso |
| /escola | Grid cursos + stats |
| /escola/novo-curso | Formulário curso |
| /escola/cursos/[id] | Aulas + alunos + concluir + certificado |

---

## 6. AUTENTICAÇÃO & AUTORIZAÇÃO

**6 Roles (hierárquicas):**
1. SUPER_ADMIN — Acesso total
2. PASTOR — Quase total
3. ADMIN — Gestão operacional
4. LEADER — Líderes de ministério/grupo
5. VOLUNTEER — Voluntários com acesso limitado
6. MEMBER — Apenas visualização

**Flow JWT:**
1. Login → accessToken (15min) + refreshToken (7 dias)
2. Frontend intercepta 401 → chama /auth/refresh
3. Novo accessToken transparente para o usuário
4. Guard `@Roles()` protege endpoints por role

**Multi-tenant:**
- Decorator `@CurrentUser('tenantId')` extrai tenantId do JWT
- Todos os queries filtram por tenantId
- Isolamento total entre igrejas

---

## 7. DEPLOY CONFIGURADO

**Frontend (Vercel):**
- `vercel.json` configurado
- Build: `pnpm --filter @ecopulse/web build`
- Env: `NEXT_PUBLIC_API_URL`

**API (VPS Hostinger via Docker):**
- `docker-compose.prod.yml` — Stack completa
- `deploy/Dockerfile.api` — Multi-stage build
- `deploy/nginx/nginx.conf` — Reverse proxy + SSL + rate limit
- Scripts: `setup.sh`, `deploy.sh`, `ssl-setup.sh`, `vps-setup.sh`
- CI/CD: GitHub Actions (lint + build em PR, deploy em push main)

---

## 8. LOGIN PADRÃO (SEED)

```
Email: admin@ecopulse.com.br
Senha: admin123
Tenant: Igreja Demo (slug: igreja-demo)
Plano: ADVANCE
```

---

## 9. O QUE FALTA IMPLEMENTAR

| Item | Prioridade | Observação |
|------|-----------|------------|
| Módulo Eventos (frontend completo) | Média | Schema Prisma já existe, falta controller+páginas |
| Wi-Fi CRM / Captive Portal (portal app) | Alta | Schema pronto, app portal básico existe |
| Automações engine (trigger → action) | Média | Schema pronto, falta service |
| Relatórios/Analytics dashboard | Média | Pode usar Recharts (já no package.json) |
| Integração WhatsApp real (Evolution API) | Alta | Endpoints prontos, falta integrar provider |
| Integração Pix real (gateway) | Alta | Endpoints prontos, falta provider |
| Upload de fotos (S3/R2) | Baixa | Campos photoUrl existem |
| Testes unitários e E2E | Média | Jest configurado, falta escrever |
| App mobile (React Native) | Futura | — |
| Página do membro (auto-serviço) | Futura | — |

---

## 10. COMO CONTINUAR

Para a nova sessão do Claude, cole este prompt:

```
Estou continuando o desenvolvimento do ECOPULSE — plataforma SaaS de gestão de igrejas.
O projeto está em: [CAMINHO_DO_PROJETO]

O que já está pronto:
- Monorepo pnpm + Turborepo
- Schema Prisma com 30+ models
- API NestJS com 8 módulos completos (Auth, Members, Kids, Ministries, Groups, Communication, Donations, School)
- Frontend Next.js 14 com 20+ páginas
- Deploy configurado (Vercel + Docker + VPS)
- CI/CD com GitHub Actions

Preciso agora de: [DESCREVA O QUE QUER FAZER PRÓXIMO]

Leia o arquivo HANDOFF.md na raiz do projeto para contexto completo.
```

---

## 11. COMANDOS DE REFERÊNCIA

```bash
# Dev
pnpm install
docker compose up -d
pnpm db:push
pnpm db:seed
pnpm dev

# Produção
./scripts/deploy.sh

# Prisma
pnpm --filter @ecopulse/api exec prisma generate
pnpm --filter @ecopulse/api exec prisma studio
pnpm --filter @ecopulse/api exec prisma migrate dev --name "descricao"
```
