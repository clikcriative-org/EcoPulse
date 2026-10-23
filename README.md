# ECOPULSE

> A plataforma completa de gestão de igrejas — Pastoreie com clareza.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Monorepo | pnpm + Turborepo |
| Frontend | Next.js 14, Tailwind CSS, shadcn/ui |
| Backend | NestJS 10, Prisma, PostgreSQL 16 |
| Cache/Queue | Redis 7, BullMQ |
| Auth | JWT + Refresh Tokens |
| Real-time | Socket.io |

## Estrutura

```
ecopulse/
├── apps/
│   ├── api/       → NestJS backend (porta 3000)
│   ├── web/       → Admin dashboard (porta 3001)
│   └── portal/    → Captive portal Wi-Fi (porta 3002)
├── packages/
│   └── shared/    → Types e utils compartilhados
├── prisma/        → Schema e migrations
└── docker-compose.yml
```

## Início Rápido

### Pré-requisitos

- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose

### Setup

```bash
# 1. Clonar e instalar
cd ecopulse
cp .env.example .env
pnpm install

# 2. Subir banco e serviços
docker compose up -d

# 3. Aplicar schema e seed
pnpm db:push
pnpm db:seed

# 4. Rodar em desenvolvimento
pnpm dev
```

### Acessos

- **API + Swagger:** http://localhost:3000/docs
- **Admin Dashboard:** http://localhost:3001
- **Captive Portal:** http://localhost:3002
- **MailHog (emails):** http://localhost:8025

### Login padrão (seed)

- Email: `admin@ecopulse.com.br`
- Senha: `admin123`

## Módulos

- **Pessoas** — Membros, famílias, visitantes
- **Ministérios** — Voluntários, escalas, funções
- **Grupos** — Células, discipulado
- **Eventos** — Cultos, conferências, presença
- **Kids** — Check-in seguro de crianças
- **Doações** — Dízimos, ofertas, campanhas (Pix + Cartão)
- **Escola** — Cursos, trilhas, certificados
- **Comunicação** — WhatsApp, e-mail, notificações
- **Wi-Fi CRM** — Captive portal, visitantes, automações
- **Relatórios** — Analytics e dashboards

## Planos

| Plano | Público | Membros |
|-------|---------|---------|
| START | Igrejas nos primeiros passos | até 300 |
| ADVANCE | Igrejas em crescimento | até 1.000 |
| PRO | Múltiplas sedes | até 10.000 |

## Preview / Teste Local

```bash
# Setup completo em um comando:
./scripts/setup.sh

# Ou passo a passo:
pnpm install
docker compose up -d
pnpm db:push
pnpm db:seed
pnpm dev
```

Após o `pnpm dev`, acesse:
- http://localhost:3001 → Dashboard (login: admin@ecopulse.com.br / admin123)
- http://localhost:3000/docs → API Swagger

## Licença

Proprietário — Todos os direitos reservados.
