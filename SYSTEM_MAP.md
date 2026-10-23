# ════════════════════════════════════════════════════════════════
# ECOPULSE — Mapa Arquitetural do Sistema
# ════════════════════════════════════════════════════════════════


## VISÃO MACRO DA PLATAFORMA

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ECOPULSE PLATFORM                                │
│                    Plataforma de Gestão de Igrejas                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │
│   │   VERCEL     │    │  VPS Docker  │    │   Externos   │             │
│   │              │    │              │    │              │             │
│   │  Dashboard   │───▶│   API REST   │◀──▶│  WhatsApp    │             │
│   │  Next.js 14  │    │   NestJS 10  │    │  Pix Gateway │             │
│   │              │    │              │    │  SMTP Email  │             │
│   │  Portal WiFi │    │  PostgreSQL  │    │  S3 Storage  │             │
│   │  Next.js 14  │    │  Redis       │    │              │             │
│   └──────────────┘    └──────────────┘    └──────────────┘             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```


## ARQUITETURA DE REDE (PRODUÇÃO)

```
                          Internet
                             │
                    ┌────────▼────────┐
                    │   Cloudflare    │  DNS + CDN
                    │   (opcional)    │
                    └───────┬─┬───────┘
                            │ │
              ┌─────────────┘ └─────────────┐
              │                             │
     ┌────────▼────────┐          ┌────────▼────────┐
     │     Vercel       │          │   VPS Hostinger │
     │                  │          │                 │
     │  app.ecopulse    │  HTTPS   │  api.ecopulse   │
     │  .com.br         │─────────▶│  .com.br        │
     │                  │          │                 │
     │  ┌────────────┐  │          │  ┌───────────┐  │
     │  │  Next.js   │  │          │  │   Nginx   │  │
     │  │  Dashboard │  │          │  │  SSL/Proxy│  │
     │  └────────────┘  │          │  └─────┬─────┘  │
     │                  │          │        │        │
     │  ┌────────────┐  │          │  ┌─────▼─────┐  │
     │  │  Next.js   │  │          │  │  NestJS   │  │
     │  │  Portal    │  │          │  │  API :4000│  │
     │  └────────────┘  │          │  └─────┬─────┘  │
     └──────────────────┘          │        │        │
                                   │  ┌─────┴─────┐  │
                                   │  │           │  │
                                   │  ▼           ▼  │
                                   │ ┌────┐  ┌─────┐ │
                                   │ │ PG │  │Redis│ │
                                   │ │5433│  │6379 │ │
                                   │ └────┘  └─────┘ │
                                   └─────────────────┘
```


## MÓDULOS DO SISTEMA

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          MÓDULOS ECOPULSE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │    AUTH      │  │   PESSOAS   │  │    KIDS     │  │ MINISTÉRIOS │  │
│  │             │  │             │  │             │  │             │  │
│  │ • Login     │  │ • Membros   │  │ • Crianças  │  │ • CRUD      │  │
│  │ • Register  │  │ • Famílias  │  │ • Check-in  │  │ • Voluntários│  │
│  │ • JWT       │  │ • Busca     │  │ • Check-out │  │ • Papéis    │  │
│  │ • Refresh   │  │ • Perfil    │  │ • Código 6ch│  │ • Funções   │  │
│  │ • RBAC      │  │ • Aniversár.│  │ • Alergias  │  │ • Cores     │  │
│  │ • 6 Roles   │  │ • Tags      │  │ • Salas     │  │             │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   GRUPOS    │  │ COMUNICAÇÃO │  │   DOAÇÕES   │  │   ESCOLA    │  │
│  │             │  │             │  │             │  │             │  │
│  │ • Células   │  │ • WhatsApp  │  │ • Dízimos   │  │ • Cursos    │  │
│  │ • Discipul. │  │ • E-mail    │  │ • Ofertas   │  │ • Aulas     │  │
│  │ • Reuniões  │  │ • SMS       │  │ • Campanhas │  │ • Matrículas│  │
│  │ • Endereço  │  │ • Templates │  │ • Pix       │  │ • Progresso │  │
│  │ • Líder     │  │ • Variáveis │  │ • Cartão    │  │ • Certificad│  │
│  │ • Anfitrião │  │ • Notificaç.│  │ • Metas     │  │ • Categorias│  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                    │
│  │  WIFI CRM   │  │  AUTOMAÇÕES │  │ RELATÓRIOS  │   ← A implementar  │
│  │             │  │             │  │             │                    │
│  │ • Portal    │  │ • Triggers  │  │ • Dashboards│                    │
│  │ • Visitantes│  │ • Condições │  │ • Exports   │                    │
│  │ • Engajam.  │  │ • Ações     │  │ • Gráficos  │                    │
│  │ • LGPD      │  │ • Logs      │  │ • Filtros   │                    │
│  └─────────────┘  └─────────────┘  └─────────────┘                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```


## FLUXO DE AUTENTICAÇÃO

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  CLIENT  │         │   API    │         │ DATABASE │
│ (Browser)│         │ (NestJS) │         │ (Postgres)│
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                     │                     │
     │  POST /auth/login   │                     │
     │  {email, password}  │                     │
     │────────────────────▶│                     │
     │                     │  Find user by email │
     │                     │────────────────────▶│
     │                     │◀────────────────────│
     │                     │                     │
     │                     │  Verify bcrypt hash │
     │                     │  Generate JWT       │
     │                     │  Store refresh token│
     │                     │────────────────────▶│
     │                     │                     │
     │  {accessToken,      │                     │
     │   refreshToken}     │                     │
     │◀────────────────────│                     │
     │                     │                     │
     │  GET /members       │                     │
     │  Auth: Bearer JWT   │                     │
     │────────────────────▶│                     │
     │                     │  Decode JWT         │
     │                     │  Extract tenantId   │
     │                     │  Check role         │
     │                     │  Query filtered by  │
     │                     │  tenantId           │
     │                     │────────────────────▶│
     │                     │◀────────────────────│
     │  200 {data, meta}   │                     │
     │◀────────────────────│                     │
     │                     │                     │
     │  (Token expires)    │                     │
     │  POST /auth/refresh │                     │
     │  {refreshToken}     │                     │
     │────────────────────▶│                     │
     │                     │  Validate & rotate  │
     │  {newAccessToken,   │                     │
     │   newRefreshToken}  │                     │
     │◀────────────────────│                     │
```


## FLUXO DO CHECK-IN KIDS

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│ RECEPÇÃO │         │   API    │         │ DATABASE │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                     │                     │
     │  POST /kids/checkin │                     │
     │  {childId, room}    │                     │
     │────────────────────▶│                     │
     │                     │  Verify not already │
     │                     │  checked in         │
     │                     │────────────────────▶│
     │                     │                     │
     │                     │  Generate code:     │
     │                     │  "A7X2K9" (6 chars) │
     │                     │                     │
     │                     │  Create ChildCheckIn│
     │                     │────────────────────▶│
     │                     │                     │
     │  {securityCode:     │                     │
     │   "A7X2K9",         │                     │
     │   child: {...}}     │                     │
     │◀────────────────────│                     │
     │                     │                     │
     │  ══════════════════════════════════════   │
     │  ║  ENTREGA CÓDIGO AO RESPONSÁVEL    ║   │
     │  ══════════════════════════════════════   │
     │                     │                     │
     │  POST /kids/checkout│                     │
     │  {securityCode:     │                     │
     │   "A7X2K9",         │                     │
     │   checkedOutBy:     │                     │
     │   "Maria Silva"}    │                     │
     │────────────────────▶│                     │
     │                     │  Validate code      │
     │                     │  matches child      │
     │                     │────────────────────▶│
     │                     │                     │
     │                     │  Update checkOutAt  │
     │                     │────────────────────▶│
     │                     │                     │
     │  200 OK             │                     │
     │◀────────────────────│                     │
```


## BANCO DE DADOS — RELAÇÕES PRINCIPAIS

```
                    ┌──────────┐
                    │  TENANT  │ ← Multi-tenant root
                    └────┬─────┘
                         │ 1:N
        ┌────────────────┼────────────────────────────┐
        │                │                            │
   ┌────▼────┐     ┌────▼────┐              ┌───────▼───────┐
   │  USER   │     │  MEMBER │              │   VISITOR     │
   │ (login) │     │ (pessoa)│              │  (wifi crm)   │
   └─────────┘     └────┬────┘              └───────┬───────┘
                         │                           │
          ┌──────────────┼──────────────┐            │
          │              │              │            │
    ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐ ┌───▼────┐
    │ MINISTRY  │ │   GROUP   │ │  DONATION │ │  VISIT │
    │  MEMBER   │ │   MEMBER  │ │           │ │        │
    └───────────┘ └───────────┘ └───────────┘ └────────┘
          │              │              │
    ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
    │ MINISTRY  │ │   GROUP   │ │ CAMPAIGN  │
    └───────────┘ └───────────┘ └───────────┘

    ┌───────────┐  ┌───────────┐  ┌───────────┐
    │   CHILD   │  │  COURSE   │  │  MESSAGE  │
    └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
          │               │               │
    ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
    │ CHECK-IN  │  │  LESSON   │  │ TEMPLATE  │
    └───────────┘  │ENROLLMENT │  └───────────┘
                   │CERTIFICATE│
                   └───────────┘
```


## ROLES & PERMISSÕES

```
┌─────────────────────────────────────────────────────────────┐
│                    HIERARQUIA DE ROLES                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  SUPER_ADMIN ─── Tudo (gestão de planos, tenants)           │
│       │                                                      │
│  PASTOR ──────── Tudo dentro do tenant                      │
│       │                                                      │
│  ADMIN ────────── Gestão operacional (membros, doações...)  │
│       │                                                      │
│  LEADER ──────── Gerencia seu ministério/grupo              │
│       │                                                      │
│  VOLUNTEER ───── Acesso limitado ao ministério              │
│       │                                                      │
│  MEMBER ──────── Apenas visualização própria                │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Endpoint Protection:                                        │
│                                                              │
│  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')                   │
│      → CRUD completo, exclusões, configs                    │
│                                                              │
│  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER')        │
│      → Adicionar/remover voluntários, membros               │
│                                                              │
│  @UseGuards(JwtAuthGuard) (sem @Roles)                      │
│      → Qualquer autenticado pode acessar (GET)              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```


## PLANOS DE ASSINATURA

```
┌───────────────┬───────────────┬───────────────┐
│    START      │    ADVANCE    │      PRO      │
│   R$ 99/mês  │  R$ 199/mês   │  R$ 399/mês   │
├───────────────┼───────────────┼───────────────┤
│               │               │               │
│ 300 membros   │ 1.000 membros │ 10.000 membros│
│ 3 usuários    │ 10 usuários   │ 50 usuários   │
│ 5 ministérios │ 20 ministérios│ 100 ministérios│
│               │               │               │
│ Gestão central│ + Células     │ + App próprio  │
│ Cadastro      │ + WhatsApp    │ + Multi-sede   │
│ Eventos       │ + Escola      │ + Chatbot IA   │
│ Kids básico   │ + Automações  │ + Analytics    │
│ Doações       │ + Relatórios  │ + Suporte VIP  │
│ Relatórios    │ + Integrações │               │
│               │               │               │
└───────────────┴───────────────┴───────────────┘
```


## STACK TECNOLÓGICA

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  FRONTEND                                                    │
│  ├── Next.js 14 (App Router, SSR)                           │
│  ├── React 18                                                │
│  ├── Tailwind CSS 3.4                                        │
│  ├── Lucide React (ícones)                                   │
│  ├── Axios (HTTP client)                                     │
│  ├── React Hook Form + Zod (formulários)                    │
│  ├── Recharts (gráficos)                                     │
│  └── TanStack Query (cache/state)                           │
│                                                              │
│  BACKEND                                                     │
│  ├── NestJS 10 (framework)                                   │
│  ├── Prisma ORM (database)                                   │
│  ├── PostgreSQL 16 (dados)                                   │
│  ├── Redis 7 (cache + queue)                                 │
│  ├── BullMQ (background jobs)                               │
│  ├── Passport + JWT (auth)                                   │
│  ├── Swagger/OpenAPI (docs)                                  │
│  ├── class-validator (DTOs)                                  │
│  ├── Helmet (security headers)                               │
│  └── Socket.io (real-time)                                   │
│                                                              │
│  INFRA                                                       │
│  ├── Docker + Docker Compose                                 │
│  ├── Nginx (reverse proxy)                                   │
│  ├── Certbot (SSL auto)                                      │
│  ├── GitHub Actions (CI/CD)                                  │
│  ├── Vercel (frontend hosting)                               │
│  └── VPS Hostinger (API + DB)                               │
│                                                              │
│  MONOREPO                                                    │
│  ├── pnpm (package manager)                                  │
│  ├── Turborepo (build orchestration)                         │
│  └── Shared packages (types, utils)                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```


## FLUXO DE DEPLOY

```
  Developer                  GitHub                 Vercel / VPS
     │                         │                        │
     │   git push main         │                        │
     │────────────────────────▶│                        │
     │                         │                        │
     │                         │── CI: lint + build ──▶ │
     │                         │                        │
     │                         │── Vercel webhook ────▶ │ (Frontend)
     │                         │   Auto-deploy Next.js  │
     │                         │                        │
     │                         │── SSH to VPS ────────▶ │ (API)
     │                         │   git pull             │
     │                         │   docker build         │
     │                         │   docker up            │
     │                         │   prisma migrate       │
     │                         │                        │
     │   ✓ Deploy concluído    │                        │
     │◀────────────────────────│                        │
```
