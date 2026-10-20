# EcoPulse — Estrutura de dados e protocolo (para integração/migração)

> Fonte: `ecopulse-deploy.zip` (SHA-256 `838f22cc8c59e4ed698c4329ca3801aceeac337aa2c32d6e14e91b44565ec7e2`),
> inventariado com REA (`inspect_artifact`, Evidence `ev_943479699e7cc82e99fa192782533f97d49bd4400970af13348c94757e2f40f4`:
> 155 arquivos, 85 diretórios, 0 contradições de integridade) e lido diretamente no código-fonte.
> Tudo aqui é **análise estática** — nada foi executado.

O "formato" do EcoPulse não é binário: são **duas interfaces** que um sistema novo precisa respeitar para ler e escrever dados.

| Interface | Quando usar | Onde está definida |
|---|---|---|
| **A. Banco PostgreSQL** (via Prisma) | Migração em lote, ETL, leitura direta | `prisma/schema.prisma` |
| **B. API REST** `/api/v1` (NestJS) | Integração em tempo real, respeitando regras de negócio | `apps/api/src/**` |

**Recomendação:** escreva pela **API** (B). Ela aplica isolamento por igreja, validação e efeitos colaterais (ex.: somar doação à campanha). Leia pelo **banco** (A) só para migração em massa, e mesmo assim sempre filtrando por `tenant_id`.

---

## 1. Convenções globais (valem para tudo)

| Regra | Detalhe | Impacto ao escrever |
|---|---|---|
| IDs | `uuid()` em todas as tabelas (34 ocorrências) | Gere UUID v4; não use inteiros |
| Nomes no banco | Campos camelCase no Prisma → **snake_case** no Postgres via `@map` (ex.: `primaryColor` → `primary_color`, tabela `Member` → `members`) | Consulta SQL direta usa snake_case |
| Dinheiro | **Inteiro em centavos** (`amountCents`, `goalCents`, `raisedCents`, `priceCents`) | R$ 50,00 = `5000`. Nunca float |
| Datas | `DateTime` (timestamp). `createdAt` = `now()` | Envie ISO-8601 com fuso |
| Fuso padrão | `Tenant.timezone` = `America/Sao_Paulo` | Converta ao exibir/relatar |
| Multi-tenant | Toda entidade de negócio tem `tenantId` (a "igreja") | **Obrigatório** em leitura e escrita |
| Cor | `primaryColor` `VARCHAR(7)`, padrão `#10b981` | Formato `#RRGGBB` |
| Enums | Strings em MAIÚSCULAS (ver §3) | Valores fora da lista são rejeitados |

---

## 2. Modelo de dados (36 tabelas)

### 2.1 Núcleo e acesso
| Tabela | Campos-chave | Unicidade / índices |
|---|---|---|
| `tenants` (Tenant) | name, **slug**, planId, logoUrl, primaryColor, `portalConfig` Json, `whatsappConfig` Json, `networkConfig` Json, timezone, active, trialEndsAt | slug único |
| `plans` (Plan) | name, slug, priceCents, maxMembers, maxUsers, maxMinistries, `features` Json, stripePriceId | global (sem tenant) |
| `users` (User) | tenantId, email, passwordHash (**bcrypt, custo 10**), name, role, phone, active, lastLoginAt | `(tenantId, email)` único |
| `refresh_tokens` | userId, token (UUID), expiresAt, revokedAt | índice em token |
| `subscriptions` | stripeCustomerId, stripeSubId, status, currentPeriodStart/End | — |
| `audit_logs` | userId, action, entityType, entityId, `changes` Json, ipAddress | — |

### 2.2 Pessoas
| Tabela | Campos-chave | Unicidade |
|---|---|---|
| `members` | fullName, email, phone, birthDate, gender, maritalStatus, endereço (street…zipCode), status, memberSince, baptismDate, salvationDate, isVolunteer, isLeader, `metadata` Json | `(tenantId, email)` |
| `families` + `family_members` | family.name; junção (memberId, familyId, role) | PK composta |
| `tags` + `member_tags` | tag.name, color | `(tenantId, name)` |
| `visitors` | fullName, **phone**, status, engagementScore, totalVisits, first/lastVisitAt, consentAt, optedOut, `metadata` Json | `(tenantId, phone)` |
| `visits` | visitorId, checkInAt/Out, durationMinutes, deviceMac, source | — |
| `devices` | visitorId, macAddress, lastSeenAt | `(tenantId, macAddress)` |
| `notes`, `tasks`, `notifications` | anotações, tarefas (priority Int, status), notificações (`data` Json, readAt) | — |

### 2.3 Ministérios, grupos, eventos
| Tabela | Campos-chave | Unicidade |
|---|---|---|
| `ministries` + `ministry_members` | name, color, iconName, leaderId; junção com role, function, active | `(memberId, ministryId)` |
| `groups` + `group_members` | name, type, meetingDay, meetingTime, address, maxMembers | `(memberId, groupId)` |
| `events` + `event_attendances` | title, type, startAt, endAt, capacity, isRecurring, `recurrence` Json | `(eventId, memberId)` |

### 2.4 Kids, Doações, Escola
| Tabela | Campos-chave | Observação |
|---|---|---|
| `children` | fullName, birthDate, allergies, medicalNotes, parentName, **parentPhone**, parentMemberId, ageGroup | dado sensível (menor + saúde) |
| `child_check_ins` | childId, checkInAt/Out, checkedInBy/OutBy, **securityCode**, room | código de 6 caracteres (§4.3) |
| `campaigns` | name, goalCents, **raisedCents** (acumulado), startAt, endAt | raisedCents é derivado |
| `donations` | memberId?, campaignId?, type, amountCents, paymentMethod, paymentStatus, transactionId, donorName/Email, isRecurring, donatedAt | doação anônima = memberId nulo |
| `courses`, `lessons` | course.mode, maxStudents; lesson.order, videoUrl, duration | — |
| `course_enrollments` | status, **progress** (0–100) | `(courseId, memberId)` |
| `certificates` | **code** único `VARCHAR(50)` | — |

### 2.5 Comunicação e automação
| Tabela | Campos-chave |
|---|---|
| `message_templates` | name, channel, `content` Json, `variables` Json (array de nomes) — único `(tenantId, name)` |
| `messages` | channel, to, `content` Json, status, externalId, sentAt, failedAt, errorMsg |
| `automations` | triggerType, `triggerConfig` Json, `conditions` Json, `actions` Json, timesTriggered |
| `automation_logs` | actionType, status, `result` Json, error |
| `network_devices` | provider, host, port, username, passwordEnc, **apiKey**, `config` Json |

---

## 3. Enums (valores aceitos)

| Enum | Valores |
|---|---|
| UserRole | SUPER_ADMIN, PASTOR, ADMIN, LEADER, VOLUNTEER, MEMBER |
| Gender | MALE, FEMALE, OTHER, NOT_INFORMED |
| MaritalStatus | SINGLE, MARRIED, DIVORCED, WIDOWED, NOT_INFORMED |
| MemberStatus | ACTIVE, INACTIVE, TRANSFERRED, DECEASED |
| VisitorStatus | NEW, RETURNING, REGULAR, FAITHFUL, INACTIVE |
| DonationType | TITHE, OFFERING, CAMPAIGN, SPECIAL |
| PaymentMethod | PIX, CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, CASH |
| PaymentStatus | PENDING, CONFIRMED, FAILED, REFUNDED |
| MessageStatus | QUEUED, SENT, DELIVERED, READ, FAILED |
| TaskStatus | PENDING, IN_PROGRESS, COMPLETED, CANCELED |
| SubscriptionStatus | TRIALING, ACTIVE, PAST_DUE, CANCELED, UNPAID |
| GroupType | CELL, DISCIPLESHIP, MINISTRY_GROUP, COURSE_GROUP |
| EventType | SERVICE, CELL_MEETING, CONFERENCE, WORKSHOP, SOCIAL, OTHER |
| EnrollmentStatus | ACTIVE, COMPLETED, DROPPED, PAUSED |
| VisitSource | WIFI_PORTAL, MANUAL, BEACON, API, EVENT_CHECKIN |
| NetworkProvider | UNIFI, MIKROTIK, MERAKI, RADIUS_GENERIC |
| TriggerType | FIRST_VISIT, NTH_VISIT, ABSENCE_DAYS, BIRTHDAY, RETURN_AFTER_ABSENCE, TAG_ADDED, FUNNEL_STAGE_CHANGED, MANUAL, NEW_MEMBER, MEMBER_BIRTHDAY |
| ActionType | SEND_WHATSAPP, SEND_SMS, SEND_EMAIL, CREATE_TASK, ADD_TAG, REMOVE_TAG, NOTIFY_TEAM, WEBHOOK |

---

## 4. Protocolo da API REST

### 4.1 Transporte
- Base: `https://<host>/api/v1` · JSON · documentação Swagger em `/docs`
- Validação estrita (`whitelist` + `forbidNonWhitelisted`): **campo extra no corpo = erro 400**. Envie só os campos documentados.
- CORS restrito a `CORS_ORIGINS`.

### 4.2 Autenticação (fluxo completo)
```
POST /auth/register  { name, email, password(min 6), churchName, phone? }
  → cria Tenant (slug gerado do nome) + User role=PASTOR
POST /auth/login     { email, password }
  → { user, tenant, accessToken, refreshToken }
Requisições:  Authorization: Bearer <accessToken>
POST /auth/refresh   { refreshToken }  → novo par (o antigo é revogado: rotação)
POST /auth/logout    { refreshToken }
GET  /auth/me
```
- **accessToken**: JWT, payload `{ sub: userId, tenantId, email, role }`, validade `JWT_EXPIRES_IN` (padrão **900 s**).
- **refreshToken**: UUID opaco gravado em `refresh_tokens`, validade `REFRESH_TOKEN_EXPIRES_IN` (padrão **604800 s = 7 dias**), uso único.
- O **tenant vem do token**, não de header ou URL. Um interceptor global coloca o `tenantId` em AsyncLocalStorage e uma extensão do Prisma injeta `where.tenantId` / `data.tenantId` automaticamente em 24 models.
- Cliente de referência (`apps/web/src/lib/api.ts`): em 401 tenta `/auth/refresh` uma vez e repete a requisição; se falhar, manda para `/login`.

### 4.3 Endpoints (papéis exigidos em escrita)
`A` = SUPER_ADMIN, PASTOR, ADMIN · `L` = A + LEADER · `V` = L + VOLUNTEER · sem marca = qualquer usuário autenticado.

| Recurso | Leitura | Escrita |
|---|---|---|
| `/members` | `GET /`, `/stats`, `/birthdays`, `/:id` | `POST /` L · `PATCH /:id` L · `DELETE /:id` A |
| `/groups` | `GET /`, `/stats`, `/:id` | `POST`/`PATCH` L · `DELETE` A · `POST /:id/members`, `DELETE /:id/members/:memberId` L |
| `/ministries` | `GET /`, `/stats`, `/:id` | `POST` A · `PATCH` L · `DELETE` A · voluntários `POST/PATCH/DELETE /:id/volunteers[/:memberId]` L |
| `/kids` | `GET /children`, `/children/:id`, `/active`, `/history`, `/stats` | `POST/PATCH /children` V · `DELETE` A · `POST /checkin` V · `POST /checkout/:checkInId` V |
| `/donations` | `GET /`, `/stats`, `/campaigns` | `POST /` A · `POST/PATCH /campaigns` A |
| `/school` | `GET /courses`, `/courses/:id`, `/stats` | cursos e aulas A · `POST/DELETE /courses/:id/enroll[/:memberId]` L · `POST /courses/:id/complete/:memberId` A |
| `/communication` | `GET /templates`, `/messages`, `/stats`, `/notifications`, `/notifications/unread` | templates A · `POST /send` L · `PATCH /notifications/:id/read` |
| `/tenants` | `GET /current`, `/dashboard` | `PATCH /current` A |
| `/users` | `GET /`, `/:id` (A) | — |
| `/health` | `GET /` (público) | — |

### 4.4 Paginação (listas)
Query: `?page=1&limit=N` (+ filtros, ex.: doações aceitam `type`, `month`, `year`). Resposta:
```json
{ "data": [ ... ], "meta": { "total": 120, "page": 1, "limit": 20, "totalPages": 6 } }
```

### 4.5 Payloads que exigem atenção
**Doação** — `POST /donations`
```json
{ "amountCents": 5000, "type": "OFFERING", "paymentMethod": "PIX",
  "memberId": "uuid?", "campaignId": "uuid?", "donorName": "?", "donorEmail": "?",
  "notes": "?", "isRecurring": false }
```
Efeito: grava com `paymentStatus = CONFIRMED` e, se houver `campaignId`, soma `amountCents` em `campaign.raisedCents`.

**Check-in infantil** — `POST /kids/checkin { childId, room?, notes? }` → devolve `securityCode` de **6 caracteres** do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem I, O, 0, 1).
Checkout — `POST /kids/checkout/:checkInId { securityCode, checkedOutBy }`: o código precisa bater exatamente.

**Template** — `content` é Json livre; o formato observado é `{ "body": "Olá {{nome}}, ..." }` e `variables` é um array de nomes (`["nome","igreja"]`).
**Envio** — `POST /communication/send { channel: "whatsapp"|"email"|"sms", recipientIds: [...], recipientType: "member"|"visitor", templateId?, content?, variables? }`. Cria um registro em `messages` por destinatário com telefone/e-mail válido; quem não tem contato é **ignorado em silêncio**.

---

## 5. Receita de migração (checklist)

1. **Mapear igrejas → `tenants`** primeiro. Guarde o mapeamento `id_antigo → uuid`.
2. **Ordem de carga** (respeita as FKs): plans → tenants → users → members → families/tags → ministries/groups/events → junções → children → campaigns → donations → courses/lessons/enrollments → templates → messages.
3. **Normalizar antes de gravar:** dinheiro em centavos, telefone em E.164 (`+55...`; ele é chave única de visitante), e-mail em minúsculas (chave única por igreja), enums mapeados para os valores da §3.
4. **Senhas:** importe o hash como **bcrypt**. Se o sistema antigo usar outro algoritmo, force a redefinição de senha; não dá para converter hash.
5. **`raisedCents`:** recalcule com `SUM(amount_cents)` das doações da campanha. Não copie o valor antigo.
6. **Via API:** um usuário por igreja, papel ADMIN. Respeite o limite de 15 min do token e use o refresh.
7. **Validação:** compare contagens por tenant (membros, doações, soma em centavos) entre origem e destino.

---

## 6. Riscos encontrados (resolver antes de depender disto)

| # | Risco | Evidência | Gravidade | Ação |
|---|---|---|---|---|
| 1 | **Mensagens nunca são enviadas**: ficam em `QUEUED` | `communication.service.ts:109` — `TODO: dispatch to BullMQ` | Alta | Implementar o worker antes de prometer o recurso |
| 2 | **Variáveis `{{nome}}` não são substituídas** | `variables` do envio não é usado em `sendMessage` | Alta | Fazer a substituição no worker |
| 3 | Código de segurança do Kids usa `Math.random` | `kids.service.ts:232` | Média (segurança de criança) | Trocar por `crypto.randomInt` |
| 4 | Doação + atualização da campanha **fora de transação** | `donations.service.ts:12-35` | Média | `prisma.$transaction` |
| 5 | Login busca usuário só por e-mail (`findFirst`), mas a unicidade é `(tenantId, email)` | `auth.service.ts` login | Média em migração | Garanta e-mail único **global** ao importar |
| 6 | Tokens no `localStorage` (exposto a XSS) | `apps/web/src/lib/api.ts` | Média | Cookie httpOnly |
| 7 | Refresh token e `network_devices.apiKey` em texto puro no banco | schema + `auth.service.ts` | Média | Gravar hash / criptografar |
| 8 | Tabelas de automação, Wi-Fi e assinatura **existem sem API**; visitantes não têm endpoint próprio, só são lidos no envio de mensagens | nenhum controller as referencia | Info | Tratar como "planejado", não como recurso pronto |
| 9 | Tabelas de junção sem `tenantId` dependem do serviço validar o pai | comentário em `tenant.extension.ts` | Baixa | Em ETL direto, valide o pai manualmente |

## 7. O que NÃO foi confirmado
- Formato real dos Json `portalConfig`, `whatsappConfig`, `networkConfig`, `triggerConfig`, `conditions`, `actions`, `recurrence` e `metadata`: nenhum código lê ou escreve esses campos, então o schema deles **não está definido**.
- Comportamento em execução (nada foi rodado) e o estado do banco de produção.
- Corpo exato das respostas de `/stats` e `/dashboard`: só lido parcialmente.
- Se o `ecopulse-deploy.zip` é idêntico ao que está em produção.
