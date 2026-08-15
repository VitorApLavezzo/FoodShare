# Diagrama Entidade-Relacionamento

Gerado a partir de [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma)
(fonte da verdade — este diagrama deve ser atualizado se o schema mudar).

```mermaid
erDiagram
    USER ||--o{ ORGANIZATION_USER : "vincula-se a"
    USER ||--o{ REFRESH_TOKEN : possui
    USER ||--o{ AUDIT_LOG : gera
    USER ||--o{ NOTIFICATION : recebe
    USER ||--o{ PICKUP : confirma

    ORGANIZATION ||--o{ ORGANIZATION_USER : "tem membros"
    ORGANIZATION ||--o{ DONATION : "publica (se DONOR)"
    ORGANIZATION ||--o{ RESERVATION : "reserva (se NGO)"
    ORGANIZATION }o--|| ADDRESS : localizada_em

    DONATION ||--o{ RESERVATION : "recebe (histórico)"
    DONATION ||--o{ AUDIT_LOG : gera

    RESERVATION ||--o| PICKUP : confirma_em

    USER {
        uuid id PK
        string email UK
        string passwordHash
        string name
        enum role "ADMIN | DONOR | NGO"
        boolean isActive
        string nodeId
    }

    ADDRESS {
        uuid id PK
        string street
        string city
        string state
        string zipCode
        float latitude
        float longitude
    }

    ORGANIZATION {
        uuid id PK
        enum kind "DONOR | NGO"
        string legalName
        string tradeName
        string document "CNPJ, opcional"
        enum type "RESTAURANT | MARKET | BAKERY | OTHER"
        enum approvalStatus "PENDING | APPROVED | REJECTED | BLOCKED"
        int estimatedCapacity "opcional, NGO"
        uuid addressId FK
        string nodeId
        int version
    }

    ORGANIZATION_USER {
        uuid id PK
        uuid organizationId FK
        uuid userId FK
    }

    DONATION {
        uuid id PK
        uuid donorOrganizationId FK
        string foodName
        enum category
        float quantity
        string unit
        datetime availableAt
        datetime pickupDeadline
        datetime expiresAt
        enum status "AVAILABLE|RESERVED|PICKUP_PENDING|PICKED_UP|DISTRIBUTED|EXPIRED|CANCELLED"
        string nodeId
        int version
    }

    RESERVATION {
        uuid id PK
        uuid donationId FK
        uuid ngoOrganizationId FK
        enum status "ACTIVE | CANCELLED | COMPLETED"
        string pickupCode UK
        datetime reservedAt
        datetime cancelledAt
        string nodeId
    }

    PICKUP {
        uuid id PK
        uuid reservationId FK "UK — 1:1"
        uuid confirmedByUserId FK
        datetime confirmedAt
        string nodeId
    }

    REFRESH_TOKEN {
        uuid id PK
        uuid userId FK
        string token UK "hash bcrypt"
        datetime expiresAt
        datetime revokedAt
    }

    NODE {
        uuid id PK
        string code UK "ex: LIMEIRA"
        string city
        string state
        enum status "ONLINE | OFFLINE | DEGRADED"
        datetime lastHeartbeat
    }

    SYNC_EVENT {
        uuid id PK
        string eventId UK "global, idempotência"
        string originNode
        bigint sequence
        string eventType
        string entityId
        json payload
        enum status "PENDING | SYNCED | FAILED"
        int retryCount
    }

    AUDIT_LOG {
        uuid id PK
        string entity
        string entityId
        string eventType
        uuid userId FK "opcional"
        uuid donationId FK "opcional"
        json previousData
        json newData
        string nodeId
    }

    NOTIFICATION {
        uuid id PK
        uuid userId FK
        enum type
        string title
        string message
        datetime readAt
    }
```

## Notas de design

- **`Organization` unifica Doador e ONG** (campo `kind`) em vez de duas
  tabelas — evita duplicar endereço/aprovação/contato, que são idênticos
  entre os dois perfis. Justificativa completa no README, seção "Modelo de
  dados (Fase 1)".
- **`Reservation.donationId` não é único** — uma doação pode ter várias
  reservas ao longo do tempo (cada cancelamento libera a doação para nova
  reserva); só uma `ACTIVE` por vez, garantido por transação (não por
  constraint de unicidade). Ver "Decisões de arquitetura (Fase 5)" no README
  para o bug original e a correção.
- **`Node` e `SyncEvent` não têm foreign key para `Organization`/`Donation`**
  — são tabelas de infraestrutura de sincronização, desacopladas do domínio
  de negócio por design (`entityId` é uma referência solta, não uma FK).
- **`Notification`** existe no schema (seção 30 da especificação prevê
  notificações internas) mas o serviço de emissão/consulta não foi
  implementado nas 14 fases deste projeto — gap conhecido, registrado nas
  limitações do [ARQUITETURA.md](ARQUITETURA.md).
