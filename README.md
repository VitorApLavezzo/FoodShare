# FoodShare

Plataforma distribuída de compartilhamento de alimentos excedentes, conectando
restaurantes/mercados (doadores) a ONGs (receptoras), com rastreabilidade de
ponta a ponta e arquitetura preparada para múltiplos nós regionais.

> **Status:** Todas as 14 fases concluídas. Documentação acadêmica completa
> em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) (problema, solução,
> conceitos de sistemas distribuídos aplicados, demonstração passo a passo)
> e [`docs/DER.md`](docs/DER.md) (diagrama entidade-relacionamento). Gaps
> conhecidos documentados honestamente ao longo deste README e em
> `docs/ARQUITETURA.md` §7 — não escondidos.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router + TanStack Query |
| Backend | NestJS + TypeScript |
| Banco de dados | PostgreSQL + Prisma ORM |
| Cache / filas | Redis (+ BullMQ nas próximas fases) |
| Infra | Docker + Docker Compose |

## Estrutura do monorepo

```text
foodshare/
├── apps/
│   ├── web/     # frontend React/Vite
│   └── api/     # backend NestJS + Prisma
├── packages/    # código compartilhado (types, validation, shared) — a popular nas próximas fases
├── infrastructure/
│   └── docker/  # Dockerfiles
├── docker-compose.yml
└── .env.example
```

Monorepo gerenciado com **npm workspaces** (sem Turborepo/Nx por enquanto —
simplicidade primeiro).

## Como rodar

### Opção 1 — Docker Compose (recomendado)

```bash
docker compose up -d
```

Isso sobe: `postgres` (5432), `redis` (6379), `api` (3000, nó `LIMEIRA`) e `web` (5173).

- Frontend: http://localhost:5173
- API: http://localhost:3000
- Swagger: http://localhost:3000/docs
- Health: http://localhost:3000/health · Readiness: http://localhost:3000/ready

Migrações do Prisma e o seed inicial rodam automaticamente ao subir o
container da API (`prisma migrate deploy` + seed idempotente).

### Login de demonstração

O seed cria um usuário administrador:

```text
email: admin@foodshare.org
senha: foodshare123
```

Doadores e ONGs se cadastram livremente em `POST /auth/register` (ou pela
tela `/register` no frontend) — apenas o papel `ADMIN` não é auto-registrável.

### Autenticação

- `POST /auth/register`, `POST /auth/login` → retornam `accessToken` (15 min)
  e `refreshToken` (7 dias).
- `POST /auth/refresh` → rotaciona o refresh token (o antigo é revogado ao ser usado).
- `POST /auth/logout` → revoga o refresh token informado.
- Todas as demais rotas exigem `Authorization: Bearer <accessToken>` por padrão
  (guard global); rotas específicas usam `@Public()` para abrir exceção
  (ex.: `/health`, `/ready`, `/auth/*`) e `@Roles(...)` para restringir por papel
  (ex.: `/nodes` é `ADMIN`-only).

### Demonstrando múltiplos nós regionais

O projeto é também um exercício de Sistemas Distribuídos: cada instância do
backend é um "nó" identificado por `NODE_ID`. Todos os nós compartilham o
mesmo PostgreSQL (decisão da Fase 1), mas cada um roda seu próprio processo,
seu próprio heartbeat, e se comunica com os demais via eventos publicados em
um Redis Stream (Fase 10) — não é só heartbeat isolado, é sincronização de
verdade entre processos independentes.

```bash
# nó adicional em Campinas, na porta 3001
docker compose --profile node-campinas up -d api-campinas

# nó adicional em São Paulo, na porta 3002
docker compose --profile node-sao-paulo up -d api-sao-paulo

# ver todos os nós registrados (heartbeat, status, eventos pendentes) — requer login de admin
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@foodshare.org","password":"foodshare123"}' | jq -r .accessToken)
curl http://localhost:3000/nodes -H "Authorization: Bearer $TOKEN"
```

**Demonstrando sincronização em tempo real**: com `api` e `api-campinas` ambos
rodando, crie uma doação via `POST /donations` em qualquer um dos dois — o
outro loga o recebimento em segundos (`docker compose logs api-campinas -f`).

**Demonstrando tolerância a falhas** (seção 47 da especificação — testado de
verdade, ver decisões da Fase 11 abaixo):

```bash
docker compose stop api-campinas          # simula o nó caindo
# ... crie algumas doações via API neste intervalo, com api-campinas parado ...
docker compose --profile node-campinas up -d api-campinas   # nó volta
docker compose logs api-campinas --tail 20                  # mostra o catch-up dos eventos perdidos
```

### Opção 2 — Desenvolvimento local (sem Docker para api/web)

```bash
npm install

# suba só a infraestrutura
docker compose up -d postgres redis

# backend
cp apps/api/.env.example apps/api/.env   # ajuste se necessário
npm run prisma:migrate
npm run prisma:seed    # cria o usuário admin de demonstração
npm run dev:api

# frontend (em outro terminal)
cp apps/web/.env.example apps/web/.env
npm run dev:web
```

## Decisões de arquitetura (Fase 1)

- **Monorepo com npm workspaces**: menor overhead de ferramentas para o
  tamanho atual do projeto. Pode migrar para Turborepo/Nx se o build ficar lento.
- **Um nó = uma instância do backend**, diferenciada por `NODE_ID` / `NODE_NAME` /
  `NODE_CITY` / `NODE_STATE` (variáveis de ambiente). Cada nó se autorregistra
  na tabela `nodes` no boot e envia heartbeat periódico (15s); um nó é
  considerado `OFFLINE` se não há heartbeat há mais de 45s (calculado em
  `GET /nodes`, ver [nodes.service.ts](apps/api/src/modules/nodes/nodes.service.ts)).
- **Banco compartilhado nesta fase**: replicação/particionamento por nó é uma
  decisão de Fase 10-11, não de Fase 1. Documentar isso evita a armadilha de
  "arquitetura distribuída só no discurso" — hoje a app funciona corretamente
  de ponta a ponta; a camada distribuída será adicionada de forma incremental.
- **Consistência forte vs. eventual**: reservas de doação (Fase 5) usarão
  transação + `SELECT ... FOR UPDATE` via Prisma `$transaction` — não é
  aceitável que duas ONGs reservem a mesma doação. Dashboards/estatísticas
  (Fase 7+) podem tolerar segundos de atraso via eventos assíncronos (Redis/BullQ).
- **Prisma 6, não 7**: a v7 exige mover a `DATABASE_URL` para `prisma.config.ts`
  com adapters, o que é uma mudança maior sem benefício para este projeto.
  Fixado em `^6` para manter o schema clássico (`url = env("DATABASE_URL")`).
- **Tailwind v4**: configuração via `@theme` no CSS (sem `tailwind.config.js`),
  com suporte a dark mode via classe `.dark` no `<html>`.
- **Padrão de erro de API**: todo erro HTTP retorna
  `{ success: false, error: { code, message, details? }, correlationId }`
  (ver [all-exceptions.filter.ts](apps/api/src/common/filters/all-exceptions.filter.ts)).
- **Correlation ID**: todo request recebe/propaga `X-Correlation-ID`
  (gerado se ausente) via middleware, presente nos logs de erro.

## Decisões de arquitetura (Fase 2)

- **Guard global "deny by default"**: `JwtAuthGuard` é registrado como
  `APP_GUARD`, então toda rota exige autenticação a menos que marcada
  `@Public()`. Isso evita esquecer de proteger um endpoint novo — o padrão
  seguro é o oposto do padrão aberto.
- **Refresh token rotacionado e hasheado**: o valor enviado ao cliente é um JWT
  assinado (`jwt.refreshSecret`) contendo um `jti`; o servidor guarda só o
  bcrypt-hash desse JWT na tabela `refresh_tokens`, indexado pelo `jti`. A
  cada uso o token é revogado e um novo é emitido — reuso de um token já
  revogado falha imediatamente (ver [auth.service.ts](apps/api/src/modules/auth/auth.service.ts)).
- **RBAC via decorators**: `@Roles(UserRole.ADMIN, ...)` + `RolesGuard`
  (global, avaliado depois do `JwtAuthGuard`). Sem `@Roles`, qualquer usuário
  autenticado pode acessar a rota.
- **`/nodes` restrito a ADMIN**: consistente com a seção de administração de
  nós — visualizar topologia/heartbeat é uma operação administrativa, não pública.

## Decisões de arquitetura (Fase 3)

- **`/donors` e `/ngos` como rotas REST separadas, mas um único modelo por
  baixo**: mantém a superfície de API alinhada à especificação (seção 35) sem
  duplicar a lógica de posse/aprovação — `OrganizationsService` recebe o
  `OrganizationKind` como parâmetro e os controllers são wrappers finos.
- **Posse via `OrganizationUser`**: um usuário só enxerga/edita a própria
  organização (verificado em toda leitura/escrita); `ADMIN` tem acesso total.
  Um usuário só pode ter uma organização do seu tipo — segunda tentativa de
  cadastro retorna `409 ORGANIZATION_ALREADY_EXISTS`.
- **Criação em transação**: `Address` + `Organization` + `OrganizationUser`
  são criados atomicamente em `$transaction` — nunca deve existir uma
  organização órfã sem endereço ou sem vínculo de usuário.
- **Aprovação via `PATCH /donors/:id/approval` e `/ngos/:id/approval`**
  (`ADMIN`-only): separado do `PUT` de edição normal para que o dono da
  organização nunca consiga alterar o próprio `approvalStatus`.

## Decisões de arquitetura (Fase 4)

- **Publicar doação exige estabelecimento aprovado**: `POST /donations`
  verifica que o usuário tem uma organização `DONOR` com `approvalStatus =
  APPROVED`; caso contrário retorna `403` com `DONOR_ORGANIZATION_REQUIRED` ou
  `DONOR_ORGANIZATION_NOT_APPROVED`.
- **Regras de data validadas no backend, nunca só no frontend** (seção 12 da
  especificação): `pickupDeadline` deve ser posterior a `availableAt` e não
  pode ultrapassar `expiresAt`; `expiresAt` não pode estar no passado.
  Reaplicadas também no `PUT` (com os valores atuais como fallback para campos
  não enviados).
- **Imutabilidade após sair de `AVAILABLE`**: `PUT`/`DELETE` só funcionam
  enquanto a doação está `AVAILABLE` — depois de reservada, retirada,
  cancelada ou expirada, vira somente leitura (ver `getOwnedEditableDonation`
  em [donations.service.ts](apps/api/src/modules/donations/donations.service.ts)).
- **Visibilidade por papel em `GET /donations`**: `DONOR` vê só as próprias
  (qualquer status); `NGO` vê só `AVAILABLE` de doadores aprovados e ainda
  não expiradas; `ADMIN` vê tudo. O filtro é aplicado no `where` do Prisma,
  não em memória.
- **Job de expiração**: `@nestjs/schedule` roda a cada minuto e marca como
  `EXPIRED` toda doação `AVAILABLE` cujo `expiresAt` já passou — evita
  depender de checagem no momento da leitura (ver
  [donations-expiration.job.ts](apps/api/src/modules/donations/donations-expiration.job.ts)).
- **`DELETE` é cancelamento lógico**: define `status = CANCELLED`, não remove
  a linha — mantém histórico/auditoria (seção 15 da especificação) intacto.

## Decisões de arquitetura (Fase 5) — concorrência de reserva

Esta é a parte mais sensível do sistema (seção 13 da especificação): duas
ONGs não podem reservar a mesma doação, mesmo disputando no mesmo milissegundo.

- **`SELECT ... FOR UPDATE` dentro de uma transação Prisma**, não
  `if (available) reserve()`. `ReservationsService.reserve` trava a linha da
  doação (`tx.$queryRaw` com `FOR UPDATE`) antes de checar o status; uma
  segunda transação concorrente para a mesma doação **bloqueia** até a
  primeira commitar, e só então lê `status = RESERVED` e falha com `409
  DONATION_ALREADY_RESERVED` — nunca as duas leem `AVAILABLE` ao mesmo tempo
  (ver [reservations.service.ts](apps/api/src/modules/reservations/reservations.service.ts)).
- **Bug de schema corrigido nesta fase**: `Reservation.donationId` estava
  `@unique` desde a Fase 1, o que tornaria a relação Donation↔Reservation
  1:1 *para sempre* — depois de cancelada uma reserva, seria impossível
  reservar a doação de novo. Corrigido para 1:N (uma doação pode ter várias
  reservas ao longo do tempo, só uma `ACTIVE` por vez — garantido pela
  transação, não por constraint de unicidade).
- **Teste de concorrência real, não mockado**: `reservations.concurrency.spec.ts`
  roda contra o Postgres de desenvolvimento de verdade, dispara duas chamadas
  `reserve()` simultâneas (`Promise.allSettled`) para a mesma doação e
  verifica que exatamente uma vence — este é o teste de aceite explicitamente
  pedido na seção 37 da especificação. Rodar com `npm test --workspace=@foodshare/api`.
- **Reservar também exige ONG aprovada**: mesmo gate usado para doadores
  (`NGO_ORGANIZATION_REQUIRED` / `NGO_ORGANIZATION_NOT_APPROVED`), por
  simetria com a regra de doadores da Fase 4.
- **Cancelamento reabre a doação**: `POST /reservations/:id/cancel` só
  funciona enquanto a reserva está `ACTIVE` (dono ou admin), e devolve a
  doação para `AVAILABLE` dentro da mesma transação — também travando a
  linha da doação, para não correr com uma confirmação de retirada
  concorrente (que será implementada na Fase 6).
- **`pickupCode`**: código de 6 caracteres alfanuméricos sem ambiguidade
  visual (sem `0/O/1/I`), gerado por doação reservada — usado na retirada
  presencial (Fase 6).

## Decisões de arquitetura (Fase 6)

- **`PICKUP_PENDING` não é usado como passo manual nesta fase**: a
  especificação lista `RESERVED → PICKUP_PENDING → PICKED_UP`, mas não
  define o que dispara a primeira transição. Para não inventar uma regra de
  negócio não especificada, `POST /donations/:id/confirm-pickup` vai direto
  de `RESERVED` para `PICKED_UP`. O valor do enum continua no schema para uso
  futuro (ex.: notificação "pronto para retirada" antes da confirmação final).
- **Confirmação por quem estiver com o código, não por papel fixo**: a
  especificação lista "confirmar retirada" como permissão tanto do doador
  (7.1) quanto da ONG (7.2) — reflete o aperto de mão físico descrito na
  seção 14 (ONG apresenta o código, o estabelecimento confirma, mas o
  inverso também é válido). `confirmPickup` aceita doador-dono, ONG-dona ou
  admin, e sempre exige o `pickupCode` correto — é o código, não o papel,
  que autoriza a ação.
- **Endpoint por doação, não por reserva**: `POST /donations/:id/confirm-pickup`
  (não `/reservations/:id/pickup`) porque o doador natural mente só conhece o
  ID da doação, não o ID interno da reserva; o serviço resolve a reserva
  `ACTIVE` correspondente internamente.
- **Transação com lock, igual às Fases 5**: a doação é travada
  (`SELECT ... FOR UPDATE`) antes de criar o registro de `Pickup`, evitando
  corrida com um cancelamento de reserva concorrente.

## Decisões de arquitetura (Fase 7)

- **Estimativa de pessoas atendidas configurável e claramente rotulada**:
  `PEOPLE_PER_UNIT` (env, default `2.5`) multiplica a quantidade doada —
  aplicado da mesma forma a kg/unidade/litro, o que é uma simplificação
  grosseira e intencional. A API e a UI sempre rotulam o número como
  "estimativa", nunca como valor real (seção 48 da especificação exige isso
  explicitamente).
- **Agregação em memória, não SQL analítico**: as séries mensais e os
  agrupamentos por cidade/categoria são calculados em JavaScript sobre o
  resultado de uma única query, não com `GROUP BY`/`date_trunc` no Postgres.
  Aceitável no volume de dados atual do projeto; migrar para agregação SQL
  se o volume crescer (ver [dashboard.service.ts](apps/api/src/modules/dashboard/dashboard.service.ts)).
- **`GET /dashboard/{donor,ngo,admin}` sem parâmetros de período**: mostra
  sempre os últimos 6 meses. Filtros de data ficam para a Fase 12
  (Relatórios), que é o lugar apropriado para consultas parametrizadas.

## Decisões de arquitetura (Fase 8)

- **Sem PostGIS**: a especificação (seção 53) permite explicitamente optar
  por não usar PostGIS, desde que documentado. A distância é calculada com a
  fórmula de Haversine em JavaScript, sobre um conjunto já filtrado por
  categoria/quantidade/status (limitado a 500 candidatos por consulta) — não
  em SQL geoespacial. Migrar para PostGIS/`ST_DWithin` se o volume de dados
  crescer a ponto de tornar essa varredura em memória cara (ver
  [map.service.ts](apps/api/src/modules/map/map.service.ts)).
- **`/map/donors` e `/map/ngos` são de leitura ampla**: diferente de
  `/donors` e `/ngos` (Fase 3, restritos ao dono/admin), os endpoints de
  mapa expõem organizações **aprovadas** para qualquer usuário autenticado —
  é assim que uma ONG descobre doadores e vice-versa. Só dados já públicos
  por natureza (nome, tipo, localização) são retornados.
- **Geolocalização é opt-in no frontend**: `navigator.geolocation` só é
  chamado quando o usuário clica em "Usar minha localização"; sem isso, o
  mapa mostra tudo sem cálculo de distância.

## Decisões de arquitetura (Fase 9)

- **`AuditLogService.record` é best-effort**: uma falha ao gravar o log
  nunca derruba a operação de negócio que o originou (só loga o erro). Regra
  geral para auditoria: não deve ser um ponto único de falha para o sistema
  principal.
- **Gravação fora da transação de negócio**: os eventos de auditoria são
  gravados depois que a transação principal (reserva, retirada, aprovação)
  já commitou — mantém as transações críticas curtas e evita acoplar o
  sucesso da operação de negócio ao sucesso da escrita de auditoria.
- **Eventos cobertos nesta fase**: `DONATION_CREATED/UPDATED/CANCELLED/EXPIRED`,
  `DONATION_RESERVED`, `RESERVATION_CANCELLED`, `PICKUP_CONFIRMED`,
  `DONOR_REGISTERED`/`NGO_REGISTERED`, `ORGANIZATION_APPROVAL_CHANGED` —
  cobre a lista de eventos da seção 15/16 da especificação.
- **`correlationId` ainda não propagado até o audit log**: o middleware já
  gera/propaga `X-Correlation-ID` nos headers HTTP (Fase 1), mas os services
  não têm acesso direto ao request nesta arquitetura. Propagar até o
  `AuditLogService` exigiria `AsyncLocalStorage`/contexto por request —
  deixado como melhoria futura; o campo já existe no schema e é gravado como
  `null` por enquanto.

## Decisões de arquitetura (Fase 10) — sincronização entre nós

- **Redis Streams (`XADD`/`XREAD`), não Pub/Sub simples**: a primeira versão
  desta camada usava `PUBLISH`/`SUBSCRIBE`, que é fire-and-forget — uma
  mensagem publicada enquanto um nó está desligado é perdida para sempre.
  Isso violaria diretamente o requisito da Fase 11 ("eventos não devem ser
  simplesmente perdidos"), então migrei para Streams antes de considerar a
  Fase 10 concluída: cada nó grava seu próprio cursor de leitura no Redis
  (`foodshare:sync-cursor:<NODE_ID>`) e retoma exatamente de onde parou ao
  reconectar (ver [sync.service.ts](apps/api/src/modules/sync/sync.service.ts)).
- **Eventos publicados**: `DONATION_CREATED`, `DONATION_UPDATED`,
  `DONATION_CANCELLED`, `DONATION_RESERVED`, `RESERVATION_CANCELLED`,
  `PICKUP_CONFIRMED`, `ORGANIZATION_APPROVED` — mesma lista da seção 16 da
  especificação (exceto expiração automática, que fica só no audit log para
  não amplificar ruído entre múltiplos nós rodando o mesmo cron).
- **"Receber" um evento não recria dados**: os nós ainda compartilham o
  mesmo Postgres (decisão da Fase 1), então a entidade já está visível via o
  banco assim que criada. O consumidor apenas loga o recebimento — essa
  camada existe para demonstrar e validar os mecanismos de sistemas
  distribuídos (publicação assíncrona, idempotência por `eventId`, retry,
  catch-up), não para manter dados consistentes (isso já é garantido pelo
  banco compartilhado nesta fase).
- **`sequence` por nó é apenas informativo**: calculado via
  `count(*) + 1` sobre os eventos já publicados por aquele nó, não uma
  sequência atomicamente segura contra concorrência entre requisições
  simultâneas do mesmo nó. Aceitável porque `sequence` é usado só para
  exibição/ordenação no painel administrativo, nunca para lógica de negócio
  (que depende de `eventId`, esse sim globalmente único).
- **`GET /nodes` agora inclui `pendingEvents`**: contagem de eventos
  `PENDING`/`FAILED` originados por aquele nó, implementando a tabela pedida
  na seção 46 da especificação.

## Decisões de arquitetura (Fase 11) — tolerância a falhas

- **Testado de verdade, não só no papel**: subi dois nós via
  `docker compose --profile node-campinas up`, confirmei sincronização em
  tempo real (LIMEIRA cria doação → CAMPINAS loga o recebimento em
  segundos), depois rodei `docker compose stop api-campinas`, criei 3
  doações em LIMEIRA, e só então rodei `docker compose ... up api-campinas`
  de novo. Nos logs do restart, CAMPINAS processou as 3 sequências que
  perdeu enquanto estava fora — nenhum evento foi descartado. Esse é
  exatamente o cenário pedido na seção 47 da especificação.
- **Por que isso funciona apesar do container ser efêmero**: o cursor de
  leitura (`foodshare:sync-cursor:CAMPINAS`) fica no Redis, que é um serviço
  separado no `docker-compose.yml` — reiniciar o container da API não afeta
  o Redis. Se o próprio Redis for reiniciado (perdendo o stream e os
  cursores), essa camada de sincronização perde histórico; isso é tratado
  como infraestrutura de base sempre disponível nesta fase, não como um nó
  que pode "cair" independentemente.
- **Bug de infraestrutura encontrado e corrigido durante o teste**: os
  serviços `api-campinas`/`api-sao-paulo` tinham sua própria imagem Docker
  implícita (`foodshare-api-campinas`), nunca reconstruída depois da Fase 1
  — CAMPINAS estava rodando código antigo sem perceber. Corrigido
  adicionando `image: foodshare-api` explícito ao anchor `x-api-common` no
  `docker-compose.yml`, garantindo que todos os nós sempre usem a mesma
  imagem (a mais recente).

## Decisões de arquitetura (Fase 12)

- **Dois endpoints, não seis**: a especificação (seção 49) lista 6 tipos de
  relatório (doações realizadas, distribuídas, expiradas, estabelecimentos
  participantes, ONGs participantes, impacto por região). Implementei
  `GET /reports/donations` (linha a linha, filtrável) e
  `GET /reports/impact` (agregado) — os outros 4 "relatórios" são apenas
  esse mesmo dataset filtrado/agrupado de formas diferentes, então não fazem
  sentido como endpoints HTTP separados; o frontend decide o recorte.
- **CSV sem biblioteca externa**: `toCsv` em
  [to-csv.ts](apps/api/src/common/to-csv.ts) é ~10 linhas com o escaping
  mínimo necessário (aspas, vírgulas, quebras de linha) — não há
  transformação, streaming ou formatos além do CSV, então uma dependência
  dedicada seria peso morto. PDF (mencionado na seção 49 como "preparar para
  depois") fica para quando houver demanda real.
- **Relatórios são admin-only**: diferente dos dashboards (Fase 7, por
  papel), a tela de Relatórios é uma ferramenta de BI/auditoria — consistente
  com o restante do painel administrativo.

## Modelo de dados (Fase 1)

Schema completo em [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma),
cobrindo: `users`, `refresh_tokens`, `addresses`, `organizations` (doadores e
ONGs — ver nota abaixo), `organization_users`, `donations`, `reservations`,
`pickups`, `nodes`, `sync_events`, `audit_logs`, `notifications`.

> **Nota de design**: doadores e ONGs compartilham o modelo `Organization`
> (campo `kind: DONOR | NGO`) em vez de duas tabelas separadas, porque os
> campos de endereço, aprovação e contato são idênticos — evita duplicação
> sem esconder as diferenças (campos específicos de ONG, como
> `estimatedCapacity`, ficam opcionais).

## Roteiro

- [x] Fase 1 — Fundação (monorepo, Docker, banco, backend/frontend iniciais)
- [x] Fase 2 — Autenticação (JWT, refresh token, RBAC)
- [x] Fase 3 — Organizações (doadores, ONGs, aprovação)
- [x] Fase 4 — Doações (CRUD, categorias, validade)
- [x] Fase 5 — Reservas (concorrência); busca/filtros avançados adiados para a Fase 8 (mapa)
- [x] Fase 6 — Retirada e confirmação
- [x] Fase 7 — Dashboards (doador, ONG, admin)
- [x] Fase 8 — Mapa e geolocalização
- [x] Fase 9 — Auditoria e histórico
- [x] Fase 10 — Distribuição: heartbeat, eventos, sincronização entre nós
- [x] Fase 11 — Tolerância a falhas (nó offline, recuperação — testado com dois nós reais)
- [x] Fase 12 — Relatórios e métricas de impacto
- [x] Fase 13 — Testes (unitários, integração, concorrência); E2E automatizado (Playwright) não implementado, ver seção Testes
- [x] Fase 14 — Documentação acadêmica completa (`docs/ARQUITETURA.md`, `docs/DER.md`)

## Testes (Fase 13)

```bash
npm run test --workspace=@foodshare/api   # roda toda a suíte (26 testes)
```

### O que está coberto

- **Concorrência de reserva** (integração, contra Postgres real):
  [reservations.concurrency.spec.ts](apps/api/src/modules/reservations/reservations.concurrency.spec.ts) —
  duas reservas simultâneas para a mesma doação, exatamente uma vence; prova
  de que o `SELECT ... FOR UPDATE` da Fase 5 funciona sob carga real, não só
  na teoria.
- **Validação de regras de doação** (unitário, Prisma mockado):
  [donations.service.spec.ts](apps/api/src/modules/donations/donations.service.spec.ts) —
  datas inconsistentes, doador sem organização, organização não aprovada,
  caminho feliz (cria + audita + publica evento de sync).
- **Validação de DTO** (unitário, `class-validator` puro):
  [create-donation.dto.spec.ts](apps/api/src/modules/donations/dto/create-donation.dto.spec.ts) —
  quantidade negativa/zero, categoria inválida, data malformada.
- **RBAC** (unitário): [roles.guard.spec.ts](apps/api/src/modules/auth/guards/roles.guard.spec.ts) —
  rota sem `@Roles` libera qualquer autenticado; papel fora da lista bloqueia;
  ausência de usuário no request bloqueia.
- **Utilitários**: [pickup-code.spec.ts](apps/api/src/common/pickup-code.spec.ts)
  (formato, ausência de caracteres ambíguos) e
  [parse-duration.spec.ts](apps/api/src/common/parse-duration.spec.ts).

### O que não está coberto (e por quê)

- **E2E automatizado (Playwright)**: não implementado. Em vez disso, cada
  fase deste projeto foi validada manualmente no navegador de verdade
  (Chrome via ferramenta de automação) e via `curl` contra a API real
  rodando em Docker — os três fluxos do MVP (cadastro → doação → reserva →
  retirada; busca → filtro → reserva → confirmação; sincronização entre
  nós) foram exercitados ponta a ponta durante o desenvolvimento, só não
  ficaram como scripts reproduzíveis no repositório. Adicionar Playwright é
  a lacuna mais honesta desta fase — o investimento não coube no escopo
  desta sessão de trabalho.
- **Testes unitários dos demais services** (`OrganizationsService`,
  `ReservationsService.cancel/confirmPickup`, `DashboardService`,
  `MapService`, `SyncService`): a lógica de posse/aprovação é estruturalmente
  igual à de `DonationsService` (já testada) e foi verificada via smoke test
  HTTP em cada fase; não duplicada aqui por retorno decrescente de esforço.

## Variáveis de ambiente

Ver [`.env.example`](.env.example) (raiz, usado pelo Docker Compose),
[`apps/api/.env.example`](apps/api/.env.example) e
[`apps/web/.env.example`](apps/web/.env.example) para desenvolvimento local
sem Docker.
