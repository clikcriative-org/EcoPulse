# ESPECIFICAÇÃO COMPLETA — Plataforma de Gestão de Igrejas (referência: EcoPulse)

> **Para a IA que vai ler este arquivo (ChatGPT ou outra):**
> Este documento descreve, de forma completa e autocontida, todas as funcionalidades de um sistema de gestão de igrejas já construído (EcoPulse).
> O objetivo é **aplicar estas funcionalidades no projeto do usuário**, que é parecido mas não idêntico.
> Siga as **Instruções de aplicação** (seção 0) antes de escrever qualquer código.

---

## 0. INSTRUÇÕES DE APLICAÇÃO (leia primeiro)

1. **Compare antes de criar.** Para cada módulo da seção 4, verifique se o projeto do usuário já tem algo equivalente. Classifique como:
   - `JÁ EXISTE` → só complete as regras/campos que faltarem;
   - `PARCIAL` → complete;
   - `NÃO EXISTE` → implemente.
   Mostre essa tabela ao usuário **antes** de codar.
2. **Adapte à stack do projeto.** A referência usa NestJS + Prisma + PostgreSQL + Next.js, mas as regras valem para qualquer stack. Não troque a stack do usuário.
3. **Implemente por fases** (seção 6), uma de cada vez, e mostre o resultado de cada fase antes de seguir.
4. **Não apague dados nem tabelas existentes.** Use migrações que só adicionam. Peça confirmação antes de qualquer mudança destrutiva.
5. **Aplique as correções da seção 5.** O sistema de referência tem falhas conhecidas; **não as reproduza**.
6. **Isolamento por igreja (multi-tenant) é inegociável.** Toda leitura e escrita filtra pela igreja do usuário logado (seção 2).
7. Ao final de cada fase, rode os **critérios de aceite** do módulo e informe quais passaram.

---

## 1. VISÃO DO PRODUTO

SaaS multi-igreja: cada igreja (tenant) tem seus usuários, membros e dados totalmente isolados.

| Módulo | Para quê |
|---|---|
| Autenticação e Igreja | Cadastro da igreja, login, papéis, identidade visual |
| Dashboard | Números-chave da igreja |
| Pessoas (Membros) | Cadastro completo, busca, aniversariantes, estatísticas |
| Grupos / Células | Células, discipulado e grupos, com seus participantes |
| Ministérios / Voluntários | Ministérios e escala de voluntários |
| Kids | Cadastro de crianças, check-in/check-out com código de segurança |
| Doações | Dízimos, ofertas e campanhas com meta |
| Escola (Cursos) | Cursos, aulas, matrículas, conclusão e certificado |
| Comunicação | Templates e envio por WhatsApp, e-mail ou SMS; notificações internas |
| Configurações | Nome, logo e cor da igreja |
| *(Planejado)* | Visitantes via Wi-Fi, automações, eventos, assinatura Stripe — seção 7 |

---

## 2. CONVENÇÕES GLOBAIS

| Regra | Especificação |
|---|---|
| IDs | UUID v4 |
| Dinheiro | **Inteiro em centavos** (R$ 50,00 = `5000`). Nunca float. Formate só na tela |
| Datas | Timestamp com fuso; fuso padrão da igreja `America/Sao_Paulo` |
| Multi-tenant | Toda entidade de negócio tem `tenantId`. O `tenantId` vem do **token do usuário**, nunca do corpo ou da URL. Aplique o filtro de forma **centralizada** (middleware/extensão do ORM), não em cada consulta |
| Exclusão | **Soft delete** (`active=false` ou `status=INACTIVE`). Nunca apague membros, grupos, ministérios, crianças ou templates |
| Validação | Rejeite campos desconhecidos no corpo (HTTP 400) |
| Paginação | `?page=1&limit=N` → `{ data: [...], meta: { total, page, limit, totalPages } }` |
| Erros | Mensagens em português: "Membro não encontrado", "Credenciais inválidas" etc. |
| API | Prefixo `/api/v1`, JSON, documentação OpenAPI/Swagger |

### Papéis (RBAC)
`SUPER_ADMIN` > `PASTOR` > `ADMIN` > `LEADER` > `VOLUNTEER` > `MEMBER`

Atalhos usados abaixo:
- **A** = SUPER_ADMIN, PASTOR, ADMIN
- **L** = A + LEADER
- **V** = L + VOLUNTEER
- Leitura = qualquer usuário autenticado, salvo indicação contrária

---

## 3. MODELO DE DADOS

### Enums
```
UserRole: SUPER_ADMIN, PASTOR, ADMIN, LEADER, VOLUNTEER, MEMBER
Gender: MALE, FEMALE, OTHER, NOT_INFORMED
MaritalStatus: SINGLE, MARRIED, DIVORCED, WIDOWED, NOT_INFORMED
MemberStatus: ACTIVE, INACTIVE, TRANSFERRED, DECEASED
GroupType: CELL, DISCIPLESHIP, MINISTRY_GROUP, COURSE_GROUP
DonationType: TITHE, OFFERING, CAMPAIGN, SPECIAL
PaymentMethod: PIX, CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, CASH
PaymentStatus: PENDING, CONFIRMED, FAILED, REFUNDED
EnrollmentStatus: ACTIVE, COMPLETED, DROPPED, PAUSED
MessageStatus: QUEUED, SENT, DELIVERED, READ, FAILED
VisitorStatus: NEW, RETURNING, REGULAR, FAITHFUL, INACTIVE
EventType: SERVICE, CELL_MEETING, CONFERENCE, WORKSHOP, SOCIAL, OTHER
TaskStatus: PENDING, IN_PROGRESS, COMPLETED, CANCELED
```

### Entidades (campos essenciais; `id`, `createdAt`, `updatedAt` implícitos)
```
Tenant         name, slug(único), logoUrl?, primaryColor(#RRGGBB, padrão #10b981), secondaryColor?,
               timezone(padrão America/Sao_Paulo), active, trialEndsAt?, planId?
Plan           name, slug, priceCents, maxMembers, maxUsers, maxMinistries, features(json)
User           tenantId, email, passwordHash(bcrypt), name, role, phone?, avatarUrl?, active, lastLoginAt?
               ÚNICO: email (global — ver correção 5.5)
RefreshToken   userId, tokenHash, expiresAt, revokedAt?
Member         tenantId, fullName, email?, phone?, birthDate?, gender, maritalStatus, photoUrl?,
               street?, number?, complement?, neighborhood?, city?, state?, zipCode?,
               status(padrão ACTIVE), memberSince?, baptismDate?, salvationDate?,
               isVolunteer, isLeader, metadata(json)
               ÚNICO: (tenantId, email) · ÍNDICES: (tenantId,status), (tenantId,fullName), (tenantId,birthDate)
Family / FamilyMember(memberId, familyId, role)
Tag(tenantId, name, color) / MemberTag(memberId, tagId)
Group          tenantId, name, description?, type, leaderId?, meetingDay?, meetingTime?, address?, maxMembers?, active
GroupMember    memberId, groupId, role, joinedAt, active · ÚNICO (memberId, groupId)
Ministry       tenantId, name, description?, color, iconName?, leaderId?, active
MinistryMember memberId, ministryId, role, function?, joinedAt, active · ÚNICO (memberId, ministryId)
Child          tenantId, fullName, birthDate?, gender, photoUrl?, allergies?, medicalNotes?,
               parentName, parentPhone, parentMemberId?, ageGroup?, active
ChildCheckIn   childId, checkInAt, checkOutAt?, checkedInBy, checkedOutBy?, securityCode, room?, notes?
Campaign       tenantId, name, description?, goalCents?, raisedCents, startAt, endAt?, active
Donation       tenantId, memberId?, campaignId?, type, amountCents, paymentMethod, paymentStatus,
               transactionId?, donorName?, donorEmail?, isRecurring, notes?, donatedAt
Course         tenantId, name, description?, category?, mode, maxStudents?, startAt?, endAt?, active
Lesson         courseId, title, content?, videoUrl?, order, duration?, date?
CourseEnrollment courseId, memberId, status, progress(0–100), enrolledAt, completedAt? · ÚNICO (courseId, memberId)
Certificate    courseId, memberId, code(único, ex.: CERT-1A2B3C4D), issuedAt
MessageTemplate tenantId, name, channel(whatsapp|email|sms), content(json {body, subject?}), variables(string[]), active
                ÚNICO (tenantId, name)
Message        tenantId, visitorId?, memberId?, templateId?, channel, to, content(json), status,
               externalId?, sentAt?, failedAt?, errorMsg?, attempts
Notification   tenantId, userId, title, body?, type, readAt?, data(json)
AuditLog       tenantId, userId?, action, entityType, entityId, changes(json), ipAddress?
```

---

## 4. MÓDULOS — FUNCIONALIDADES, REGRAS E CRITÉRIOS DE ACEITE

### 4.1 Autenticação e Igreja
**Funcionalidades**
- `POST /auth/register { name, email, password(min 6), churchName, phone? }` → cria a **igreja** (slug gerado do nome: minúsculas, sem acentos, `-` como separador, máx. 80 caracteres) e o **usuário PASTOR**. Retorna `{ user, tenant, accessToken, refreshToken }`.
- `POST /auth/login { email, password }` → só usuários `active`. Atualiza `lastLoginAt`.
- `POST /auth/refresh { refreshToken }` → **rotação**: revoga o token usado e emite um par novo.
- `POST /auth/logout { refreshToken }` → revoga.
- `GET /auth/me` → perfil + dados da igreja (nome, slug, logo, cor).
- Token de acesso JWT `{ sub, tenantId, email, role }`, validade de **15 min**. Refresh com validade de **7 dias** e uso único.
- Front-end: em 401, tenta o refresh **uma vez** e repete a requisição; se falhar, manda para `/login`.

**Aceite:** e-mail repetido no cadastro → 409 "E-mail já cadastrado"; senha errada → 401 "Credenciais inválidas"; reusar um refresh já usado → 401; usuário da igreja A nunca vê dado da igreja B.

### 4.2 Dashboard
- `GET /tenants/dashboard` → `{ members, volunteers, leaders, ministries, groups }` (contagens de registros **ativos**).
- Tela: cards com esses números, mais aniversariantes do mês e resumo de doações do mês (reaproveita 4.3 e 4.7).

### 4.3 Pessoas (Membros)
- `GET /members?search=&status=&page=&limit=` (limite padrão 50). A busca procura em `fullName` e `email` (sem diferenciar maiúsculas) e em `phone`.
- `GET /members/:id` → membro completo + últimas 5 doações + grupos, ministérios, matrículas e tags.
- `POST /members` (L), `PATCH /members/:id` (L).
- `DELETE /members/:id` (A) → **soft delete**: `status = INACTIVE`.
- `GET /members/stats` → `{ total, active, volunteers, leaders, baptized, birthdaysThisMonth }`.
- `GET /members/birthdays` → membros ativos que fazem aniversário no mês atual, ordenados pelo dia: `id, fullName, birthDate, phone, photoUrl`.
- Telas: lista com busca/filtro, cadastro e perfil (`/pessoas`, `/pessoas/cadastro`, `/pessoas/[id]`).

**Aceite:** a busca "joão" encontra "João"; excluir um membro o mantém no banco como INACTIVE; e-mail repetido na mesma igreja é rejeitado.

### 4.4 Grupos / Células
- `GET /groups?type=` → grupos ativos com a contagem de participantes ativos.
- `GET /groups/:id` → grupo + participantes ativos.
- `POST` e `PATCH` (L); `DELETE` (A) faz soft delete.
- `POST /groups/:id/members { memberId, role }` (L): se o vínculo já existe e está ativo → 409 "Membro já faz parte deste grupo"; se está inativo → **reativa**.
- `DELETE /groups/:id/members/:memberId` (L) → marca o vínculo como inativo.
- `GET /groups/stats` → `{ totalGroups, totalCells, totalMembers }`.
- **Melhoria:** respeitar `maxMembers` (se cheio → 400 "Grupo lotado").

### 4.5 Ministérios / Voluntários
- CRUD igual ao de grupos: criar (A), editar (L), excluir com soft delete (A).
- Voluntários: `POST /ministries/:id/volunteers { memberId, role, function? }` (L), com a mesma regra de duplicado/reativação dos grupos. Também `PATCH` e `DELETE /ministries/:id/volunteers/:memberId` (L).
- `GET /ministries/stats` → `{ totalMinistries, totalVolunteers, topMinistries (os 5 com mais voluntários) }`.
- **Melhoria:** ao adicionar um voluntário, marcar `member.isVolunteer = true`.

### 4.6 Kids (check-in infantil) — módulo crítico de segurança
- Cadastro de crianças: `GET/POST/PATCH /kids/children` (V para escrever) e `DELETE` (A) com soft delete. Filtros `ageGroup` e `active`.
- `POST /kids/checkin { childId, room?, notes? }` (V):
  - a criança precisa existir e estar ativa; se já tiver check-in aberto → 400 "Criança já está com check-in ativo";
  - gera um **código de segurança de 6 caracteres** do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem I, O, 0, 1, para evitar confusão) usando um **gerador criptográfico**;
  - registra `checkedInBy` como o usuário logado;
  - retorna o código para impressão na etiqueta da criança e na do responsável.
- `POST /kids/checkout/:checkInId { securityCode, checkedOutBy }` (V): o código precisa **bater exatamente**; senão → 400 "Código de segurança inválido". Grava `checkOutAt` e o nome de quem retirou.
- `GET /kids/active` → crianças presentes agora (check-ins sem checkout), com sala e faixa etária.
- `GET /kids/history?date=YYYY-MM-DD` → check-ins do dia.
- `GET /kids/stats` → total de crianças ativas, presentes agora e check-ins de hoje.
- Exibir `allergies` e `medicalNotes` **em destaque** na tela de check-in.

**Aceite:** dois check-ins seguidos da mesma criança → o segundo falha; checkout com código errado falha; checkout já finalizado → 404.

### 4.7 Doações e Campanhas
- `POST /donations` (A): `{ amountCents(≥1), type, paymentMethod, memberId?, campaignId?, donorName?, donorEmail?, notes?, isRecurring? }`. Um lançamento manual entra como `CONFIRMED`. Sem `memberId` = doação anônima.
- Se houver `campaignId`: somar `amountCents` em `campaign.raisedCents` **na mesma transação** da criação da doação.
- `GET /donations?type=&month=&year=&page=&limit=` com paginação.
- `GET /donations/stats` (considera só `CONFIRMED`):
  `{ thisMonthTotal, lastMonthTotal, growth (% com 1 casa; 0 se o mês passado = 0), tithesThisMonth, offeringsThisMonth, donationsCount, uniqueDonors }`.
- Campanhas: `GET /donations/campaigns` (ativas) e `POST`/`PATCH` (A), com `goalCents` opcional. Na tela, barra de progresso `raisedCents / goalCents`.
- **Melhoria:** acesso de leitura às doações restrito a A (dado financeiro sensível).

### 4.8 Escola (Cursos)
- Cursos: `GET /school/courses` e `GET /school/courses/:id` (com aulas ordenadas por `order` e matrículas). `POST`/`PATCH` (A).
- Aulas: `POST /school/courses/:id/lessons { title, content?, videoUrl?, order, duration?, date? }` e `DELETE` (A).
- Matrícula: `POST /school/courses/:id/enroll { memberId }` (L). Se já está ativa → 409; se tinha desistido → reativa com `progress = 0`.
- Desistência: `DELETE /school/courses/:id/enroll/:memberId` (L) → `status = DROPPED`.
- Conclusão: `POST /school/courses/:id/complete/:memberId` (A) → `status = COMPLETED`, `progress = 100`, `completedAt`, e gera um **Certificado** com código `CERT-XXXXXXXX` (8 caracteres hexadecimais em maiúsculas, único).
- `GET /school/stats` → `{ totalCourses, totalEnrollments (ativas), totalCompleted, totalCertificates }`.
- **Melhorias:** respeitar `maxStudents`; não gerar um segundo certificado para o mesmo curso e membro; página pública de validação do certificado pelo código.

### 4.9 Comunicação
- Templates: `GET /communication/templates?channel=`, `GET /:id`, `POST`/`PATCH` (A), `DELETE` (A) com soft delete.
  Conteúdo: `{ body: "Olá {{nome}}, bem-vindo à {{igreja}}!", subject?: "..." }`; `variables: ["nome","igreja"]`.
- Envio: `POST /communication/send` (L):
  `{ channel, recipientIds[], recipientType: "member"|"visitor", templateId?, content?, variables? }`
  - resolve o destino pelo canal: e-mail → `email`; whatsapp/sms → `phone`;
  - cria uma `Message` por destinatário com `status = QUEUED`;
  - **substitui as variáveis** `{{x}}` (veja a correção 5.2);
  - devolve `{ sent, skipped, messages: [{ id, to, status }] }`, onde `skipped` lista quem ficou sem contato (não ignorar em silêncio).
- **Worker de envio** (correção 5.1): processa a fila, chama o provedor (ex.: WhatsApp Cloud API, SMTP, SMS) e atualiza `SENT`/`DELIVERED`/`READ`/`FAILED`, `externalId`, `errorMsg`. Até 3 tentativas com espera crescente entre elas.
- `GET /communication/messages?channel=&page=&limit=` → histórico.
- `GET /communication/stats` → `{ sent, queued, failed, templates, byChannel }`.
- Notificações internas: `GET /communication/notifications` (últimas 50 do usuário), `GET /communication/notifications/unread` e `PATCH /communication/notifications/:id/read`.
- **Conformidade (LGPD):** respeitar opt-out; não enviar para quem pediu para sair.

### 4.10 Configurações da Igreja
- `GET /tenants/current` e `PATCH /tenants/current { name?, logoUrl?, primaryColor? }` (A).
- O front-end aplica `primaryColor` como cor-tema e mostra o logo no cabeçalho e no menu lateral.

### 4.11 Usuários da equipe
- `GET /users` e `GET /users/:id` (A).
- **A completar:** convidar usuário (e-mail com link), alterar papel e desativar, sempre restrito a A. Um PASTOR não pode ser rebaixado por um ADMIN.

---

## 5. CORREÇÕES OBRIGATÓRIAS (falhas da referência — NÃO reproduzir)

| # | Problema na referência | Como implementar corretamente |
|---|---|---|
| 5.1 | Mensagens ficam em `QUEUED` para sempre (não existe worker) | Fila (BullMQ/Redis, ou tabela + job agendado) e worker com retry |
| 5.2 | Variáveis `{{nome}}` nunca são substituídas | Substituir por destinatário antes de enfileirar; variável sem valor → string vazia + aviso no log |
| 5.3 | Código do Kids gerado com `Math.random` | Usar `crypto.randomInt` (ou equivalente seguro na stack) |
| 5.4 | Doação e soma da campanha gravadas fora de transação | Transação única; ou calcular `raisedCents` com `SUM` |
| 5.5 | Login busca o usuário só pelo e-mail, mas a unicidade é por igreja | E-mail de usuário **único no sistema inteiro** (ou login com slug da igreja) |
| 5.6 | Tokens guardados no `localStorage` | Cookie `httpOnly` + `Secure` + `SameSite` para o refresh |
| 5.7 | Refresh token e chaves de API em texto puro | Guardar o hash (SHA-256) do refresh; criptografar segredos de integração |
| 5.8 | Leitura de doações liberada a qualquer papel | Restringir a A |
| 5.9 | Sem auditoria efetiva | Gravar `AuditLog` em criar/editar/excluir de membros, doações e usuários |
| 5.10 | Tabelas de junção sem `tenantId` | Sempre validar que o registro-pai (grupo, curso etc.) pertence à igreja do usuário |

---

## 6. ORDEM DE IMPLEMENTAÇÃO (fases)

| Fase | Entrega | Depende de |
|---|---|---|
| 1 | Convenções, multi-tenant centralizado, autenticação e papéis, configurações da igreja (4.1, 4.10, 5.5–5.7) | — |
| 2 | Pessoas + Dashboard (4.3, 4.2) | 1 |
| 3 | Grupos + Ministérios (4.4, 4.5) | 2 |
| 4 | Kids (4.6, 5.3) | 2 |
| 5 | Doações e campanhas (4.7, 5.4, 5.8) | 2 |
| 6 | Escola e certificados (4.8) | 2 |
| 7 | Comunicação + worker + notificações (4.9, 5.1, 5.2) | 2 |
| 8 | Usuários da equipe + auditoria (4.11, 5.9) | 1 |

Cada fase só termina quando os **critérios de aceite** do módulo passam e há um teste automatizado para o isolamento entre igrejas.

---

## 7. ROADMAP (existe só no banco da referência — implementar só se o usuário pedir)
- **Visitantes e portal Wi-Fi:** visitante identificado pelo telefone (único por igreja), visitas, aparelhos (MAC), `engagementScore`, status NEW→RETURNING→REGULAR→FAITHFUL. Integrações UniFi, MikroTik, Meraki e RADIUS. Exige consentimento LGPD (`consentAt`, `optedOut`).
- **Automações:** gatilho (primeira visita, N-ésima visita, X dias de ausência, aniversário, retorno, tag adicionada, novo membro, manual) → condições → ações (WhatsApp, SMS, e-mail, criar tarefa, adicionar/remover tag, avisar a equipe, webhook), com log de execução.
- **Eventos:** cultos, reuniões de célula e conferências com recorrência, capacidade e presença (check-in).
- **Famílias e Tags:** agrupar membros por família; etiquetas coloridas para segmentar envios.
- **Tarefas e Anotações:** tarefas atribuídas com prioridade; anotações pastorais por membro.
- **Planos e assinatura:** planos com limites (membros, usuários, ministérios) e cobrança via Stripe (trial, ativo, inadimplente, cancelado).

---

## 8. CHECKLIST FINAL (a IA deve reportar cada item)
- [ ] Tabela de comparação "JÁ EXISTE / PARCIAL / NÃO EXISTE" apresentada ao usuário
- [ ] Nenhum dado existente apagado; migrações só adicionam
- [ ] Isolamento entre igrejas testado (igreja A não lê nem altera dados da igreja B)
- [ ] Dinheiro em centavos inteiros em todo o sistema
- [ ] Soft delete em todas as entidades listadas
- [ ] Correções 5.1 a 5.10 aplicadas
- [ ] Critérios de aceite de cada módulo implementado: passaram ou falharam (com detalhe)
- [ ] O que ficou pendente listado de forma explícita
