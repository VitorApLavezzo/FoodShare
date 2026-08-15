# FoodShare — Documentação Acadêmica (Sistemas Distribuídos)

Este documento descreve o projeto FoodShare sob a ótica da disciplina de
Sistemas Distribuídos: o problema que resolve, a solução construída, os
conceitos de SD aplicados e uma demonstração reproduzível ponta a ponta.

Para decisões de arquitetura detalhadas por fase (com trechos de código e
justificativas), ver o [README](../README.md) — este documento é o resumo
conceitual; o README é a referência técnica completa.

## 1. Problema

Restaurantes, mercados e padarias geram excedentes de alimentos diariamente
que, sem um canal de escoamento rápido, são descartados. Ao mesmo tempo,
ONGs que atendem pessoas em situação de vulnerabilidade têm dificuldade em
descobrir, de forma confiável e em tempo hábil, onde há alimento disponível
para retirada antes que vença ou perca a janela de segurança para consumo.
O problema não é apenas de vontade — é de **coordenação**: sem um sistema
compartilhado, a comunicação depende de contatos informais (telefone,
grupos de WhatsApp), o que não escala, não deixa rastro auditável e não
resolve o problema central de concorrência (duas ONGs podem tentar retirar
a mesma doação e uma delas se desloca à toa).

## 2. Solução

Uma plataforma web que conecta doadores e ONGs através de um fluxo
estruturado — cadastro, publicação de doação, busca, reserva, retirada,
histórico — com as garantias que uma solução informal não oferece:

- **Consistência**: uma doação reservada por uma ONG não pode ser reservada
  por outra, mesmo sob disputa simultânea.
- **Rastreabilidade**: toda operação relevante gera um evento de auditoria.
- **Escala geográfica**: a arquitetura é multi-nó desde o início, pensada
  para operar em várias cidades/regiões sem reescrever a base do sistema.

O fluxo principal está descrito na seção "Como rodar" do README; a
plataforma cobre as 14 fases descritas ali, da fundação técnica até
relatórios de impacto.

## 3. Conceitos de Sistemas Distribuídos aplicados

| Conceito | Onde está implementado | Como demonstrar |
|---|---|---|
| **Múltiplos nós** | Cada instância do backend é um processo independente, identificado por `NODE_ID` (`apps/api/src/config/configuration.ts`). `docker-compose.yml` define perfis `node-campinas`/`node-sao-paulo` além do nó padrão. | `docker compose --profile node-campinas up -d api-campinas`; `GET /nodes` lista todos os nós registrados com heartbeat independente. |
| **Comunicação entre nós** | Redis Streams (`XADD`/`XREAD`) — `apps/api/src/modules/sync/sync.service.ts`. Cada nó publica eventos de domínio e consome os publicados pelos outros. | Ver seção 5 (demonstração) abaixo. |
| **Sincronização / replicação de eventos** | Tabela `sync_events` (schema Prisma) registra cada evento com `eventId` global, nó de origem, sequência, payload e status (`PENDING`/`SYNCED`/`FAILED`). | `GET /sync/status` e `GET /sync/events` (admin). |
| **Consistência forte vs. eventual** | Documentado explicitamente na Fase 5 do README: reserva de doação usa transação + `SELECT ... FOR UPDATE` (consistência forte, sem margem para duas reservas simultâneas vencerem); dashboards/relatórios agregam dados já persistidos, toleram milissegundos de atraso na leitura (consistência eventual, sem impacto prático). | Teste automatizado de concorrência (seção 4). |
| **Concorrência / atomicidade** | `ReservationsService.reserve` (`apps/api/src/modules/reservations/reservations.service.ts`) trava a linha da doação antes de decidir se a reserva pode ser criada. | `npm run test --workspace=@foodshare/api -- reservations.concurrency`. |
| **Tolerância a falhas** | Redis Streams persiste eventos; cada nó guarda seu próprio cursor de leitura (`foodshare:sync-cursor:<NODE_ID>`) e retoma de onde parou ao reconectar — nenhum evento publicado durante a queda de um nó é perdido. | Ver seção 5 (demonstração), passo de falha simulada. |
| **Detecção de falhas** | Heartbeat: cada nó atualiza `lastHeartbeat` a cada 15s (`NodesService`); um nó é considerado `OFFLINE` se o heartbeat está há mais de 45s sem atualizar, calculado em `GET /nodes`. | Painel "Nós & Sincronização" no dashboard admin. |
| **Eventos de domínio** | `DONATION_CREATED`, `DONATION_UPDATED`, `DONATION_CANCELLED`, `DONATION_RESERVED`, `RESERVATION_CANCELLED`, `PICKUP_CONFIRMED`, `ORGANIZATION_APPROVED` — publicados no Stream a cada transição de estado relevante. | `GET /sync/events`. |
| **Idempotência** | Cada evento tem um `eventId` (UUID) globalmente único; o consumidor ignora o próprio eco (`originNode === nodeId`) e, como os nós compartilham o banco nesta fase, a aplicação de um evento nunca duplica uma entidade. | Reenviar o mesmo evento (retry automático) não cria doações duplicadas — testável via `retryFailedEvents`. |
| **Escalabilidade horizontal** | Adicionar um novo nó é subir um novo container com um `NODE_ID` diferente — nenhuma mudança de código. | `docker compose --profile node-sao-paulo up -d api-sao-paulo`. |

### Decisão consciente: banco compartilhado nesta fase

Todos os nós apontam para o **mesmo PostgreSQL** (decisão tomada na Fase 1 e
mantida até o final do projeto). Isso significa que "receber" um evento de
outro nó não precisa reescrever dados — eles já estão visíveis via o banco
compartilhado. A camada de sincronização (Fase 10) existe para demonstrar e
validar os mecanismos pedidos pela disciplina (publicação assíncrona,
idempotência, retry, catch-up após falha) de forma real e testável, não para
manter a consistência dos dados (que já é garantida pelo banco único).

Migrar para bancos por nó com replicação real seria o próximo passo natural
— e a camada de sincronização já construída (eventos com payload completo,
idempotência por `eventId`, retry, catch-up) é o pré-requisito exato para
essa migração não exigir reescrever a lógica de comunicação entre nós.

## 4. Testes que provam as garantias de concorrência

`apps/api/src/modules/reservations/reservations.concurrency.spec.ts` roda
contra um Postgres real (não mockado): duas chamadas `reserve()` disparadas
simultaneamente (`Promise.allSettled`) para a mesma doação. Resultado
verificado automaticamente:

- Exatamente uma das duas chamadas é bem-sucedida.
- A outra falha com `409 DONATION_ALREADY_RESERVED`.
- Existe exatamente um registro de reserva no banco ao final.
- Reservar novamente a mesma doação já reservada também falha corretamente.

## 5. Demonstração passo a passo

Reproduzível localmente com Docker (ver README para pré-requisitos).

```text
1. Subir a infraestrutura base + nó Limeira
   $ docker compose up -d
   → Postgres, Redis, API (NODE_ID=LIMEIRA), frontend.

2. Subir um segundo nó, Campinas
   $ docker compose --profile node-campinas up -d api-campinas
   → NODE_ID=CAMPINAS, processo independente, mesmo banco, escutando o
     mesmo Redis Stream.

3. Confirmar os dois nós registrados
   $ curl http://localhost:3000/nodes -H "Authorization: Bearer $TOKEN"
   → [{"code":"LIMEIRA","status":"ONLINE",...}, {"code":"CAMPINAS","status":"ONLINE",...}]

4. Restaurante (doador) cria uma doação via LIMEIRA
   $ curl -X POST http://localhost:3000/donations ...
   → Donation criada; SyncService.publishEvent('DONATION_CREATED', ...)
     grava em sync_events (status SYNCED) e publica no Redis Stream.

5. Evento é replicado
   → XADD no stream "foodshare:sync-stream".

6. Nó Campinas recebe o evento
   $ docker compose logs api-campinas -f
   → "[sync] Nó CAMPINAS recebeu DONATION_CREATED (entidade ...) do nó LIMEIRA"
     em poucos segundos, sem polling manual.

7. ONG (cadastrada e aprovada) visualiza a doação
   $ curl http://localhost:3000/donations -H "Authorization: Bearer $NGO_TOKEN"
   → doação aparece na lista de disponíveis (visível via banco compartilhado,
     independente de qual nó a ONG está usando).

8. ONG reserva
   $ curl -X POST http://localhost:3000/donations/:id/reserve ...
   → transação com lock de linha garante atomicidade; reserva criada,
     evento DONATION_RESERVED publicado.

9. Retirada é confirmada (código apresentado presencialmente)
   $ curl -X POST http://localhost:3000/donations/:id/confirm-pickup ...
   → Donation.status = PICKED_UP; Reservation.status = COMPLETED;
     evento PICKUP_CONFIRMED publicado.

10. Histórico é atualizado
    $ curl http://localhost:3000/audit-logs -H "Authorization: Bearer $ADMIN_TOKEN"
    → todos os eventos acima aparecem, em ordem, com nó de origem e usuário.
```

### Demonstração de tolerância a falhas (seção 47 da especificação)

```text
$ docker compose stop api-campinas                     # nó cai
$ curl -X POST http://localhost:3000/donations ...      # eventos publicados
$ curl -X POST http://localhost:3000/donations ...        (Campinas OFFLINE,
$ curl -X POST http://localhost:3000/donations ...         mas nada se perde)
$ docker compose --profile node-campinas up -d api-campinas   # nó volta
$ docker compose logs api-campinas --tail 20
  → mostra os 3 eventos que Campinas "perdeu" sendo processados no boot,
    catch-up automático via cursor persistido no Redis.
```

Esse teste foi executado de verdade durante o desenvolvimento (não é só
teoria) — os logs reais estão documentados na seção "Decisões de
arquitetura (Fase 11)" do [README](../README.md).

## 6. Modelo de dados

Ver [DER.md](DER.md) para o diagrama entidade-relacionamento completo.

## 7. Limitações conhecidas e próximos passos

- Banco compartilhado entre nós (ver seção 3) — migrar para bancos por nó
  com replicação via os eventos já existentes é o próximo passo natural.
- Sem PostGIS: distância calculada em memória via fórmula de Haversine
  (decisão documentada na Fase 8 do README); migrar se o volume de dados
  justificar.
- Sem testes E2E automatizados (Playwright); fluxos validados manualmente
  em navegador real durante cada fase (ver seção "Testes" do README).
- `correlationId` não propagado até os logs de auditoria/sincronização
  (exigiria `AsyncLocalStorage` por request) — campo já existe no schema,
  gravado como `null` por enquanto.
- **Notificações internas (seção 30 da especificação) não implementadas**:
  o modelo `Notification` existe no schema desde a Fase 1, mas o serviço de
  emissão (ex.: "sua doação foi reservada") e a tela de consulta não foram
  construídos nas 14 fases — gap conhecido, não um esquecimento silencioso.
