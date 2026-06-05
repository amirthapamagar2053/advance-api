# Advance Management & Settlement System — NestJS Backend Design

**Date:** 2026-06-05
**Status:** Approved
**Deployment Target:** Render (Docker)
**Database:** PostgreSQL via Supabase
**Storage:** Supabase Storage

---

## 1. Overview

A REST API built with NestJS that implements a 4-workflow Advance Management & Settlement System:

1. **Advance Request** (Employee) — create and submit advance requests
2. **Advance Approval/Rejection** (Supervisor / Finance Manager) — review and action advance requests
3. **Advance Settlement** (Employee) — submit expense breakdowns with receipt uploads
4. **Settlement Approval/Rejection** (Finance Director) — review and finalize settlements

---

## 2. Architecture

**Pattern:** Feature Modules (Option A)
**ORM:** Prisma
**Auth:** Full auth module — JWT (Bearer) + bcrypt password hashing + RBAC

### Module Map

```
src/
├── auth/           → POST /auth/register, POST /auth/login
├── users/          → User entity, UserService (consumed by AuthModule)
├── advances/       → Employee + Manager workflows for advance requests
├── settlements/    → Employee + Manager workflows for settlements + file uploads
├── common/         → JwtAuthGuard, RolesGuard, @Roles() decorator, PrismaService
└── app.module.ts
```

### Request Lifecycle

```
Request → JwtAuthGuard (validates JWT) → RolesGuard (checks role)
       → Controller → Service → PrismaService → DB
```

---

## 3. Data Schema (Prisma)

```prisma
enum Role {
  employee
  supervisor
  finance_manager
  finance_director
}

enum AdvanceStatus {
  Draft
  Pending_Supervisor
  Approved
  Rejected
  Returned
}

enum SettlementStatus {
  Pending_Review
  Approved
  Returned_for_Revision
}

model User {
  id              String           @id @default(uuid())
  email           String           @unique
  password        String
  name            String
  role            Role             @default(employee)
  createdAt       DateTime         @default(now())
  advanceRequests AdvanceRequest[]
  settlements     Settlement[]
  approvalLogs    ApprovalLog[]
}

model AdvanceRequest {
  id            String         @id @default(uuid())
  requestNumber String         @unique  // e.g. ADV-1042
  employeeId    String
  employee      User           @relation(fields: [employeeId], references: [id])
  amount        Decimal        @db.Decimal(12, 2)
  purpose       String
  status        AdvanceStatus  @default(Draft)
  createdAt     DateTime       @default(now())
  settlements   Settlement[]
  approvalLogs  ApprovalLog[]  @relation("AdvanceLogs")
}

model Settlement {
  id               String           @id @default(uuid())
  referenceNumber  String           @unique  // e.g. SET-3021
  advanceRequestId String
  advanceRequest   AdvanceRequest   @relation(fields: [advanceRequestId], references: [id])
  employeeId       String
  employee         User             @relation(fields: [employeeId], references: [id])
  totalUtilized    Decimal          @db.Decimal(12, 2)
  status           SettlementStatus @default(Pending_Review)
  createdAt        DateTime         @default(now())
  expenses         SettlementExpense[]
  approvalLogs     ApprovalLog[]    @relation("SettlementLogs")
}

model SettlementExpense {
  id           String     @id @default(uuid())
  settlementId String
  settlement   Settlement @relation(fields: [settlementId], references: [id], onDelete: Cascade)
  expenseType  String
  amount       Decimal    @db.Decimal(12, 2)
  receiptUrl   String
}

model ApprovalLog {
  id               String          @id @default(uuid())
  advanceRequestId String?
  advanceRequest   AdvanceRequest? @relation("AdvanceLogs", fields: [advanceRequestId], references: [id])
  settlementId     String?
  settlement       Settlement?     @relation("SettlementLogs", fields: [settlementId], references: [id])
  action           String          // 'Approved', 'Rejected', 'Returned', 'Returned for Revision'
  actorId          String
  actor            User            @relation(fields: [actorId], references: [id])
  comments         String?
  createdAt        DateTime        @default(now())
}
```

### Request Number Generation

Two PostgreSQL sequences created via Prisma migration raw SQL:

```sql
CREATE SEQUENCE advance_request_seq START 1000;
CREATE SEQUENCE settlement_seq START 3000;
```

Services call `SELECT nextval('advance_request_seq')` and format as `ADV-{n}` / `SET-{n}`.

---

## 4. API Endpoints

### Auth

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register with name, email, password, role |
| POST | `/auth/login` | Public | Returns JWT access_token |

### Advances

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/advances` | employee | Create advance request (Draft) |
| GET | `/advances` | employee | List own advance requests |
| GET | `/advances/pending` | supervisor, finance_manager | List all Pending_Supervisor requests |
| GET | `/advances/:id` | All authenticated | Get single advance request |
| PATCH | `/advances/:id/submit` | employee | Draft → Pending_Supervisor |
| PATCH | `/advances/:id/approve` | supervisor, finance_manager | Approve (DB transaction) |
| PATCH | `/advances/:id/reject` | supervisor, finance_manager | Reject (DB transaction) |
| PATCH | `/advances/:id/return` | supervisor, finance_manager | Return (DB transaction) |

### Settlements

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/settlements` | employee | Create settlement + upload receipts (multipart/form-data) |
| GET | `/settlements` | employee | List own settlements |
| GET | `/settlements/pending` | finance_director | List Pending_Review settlements with nested expenses |
| GET | `/settlements/:id` | All authenticated | Get settlement + expenses + original advance amount |
| PATCH | `/settlements/:id/approve` | finance_director | Approve (DB transaction) |
| PATCH | `/settlements/:id/return` | finance_director | Return for revision (DB transaction) |

> **Implementation note:** `pending` routes (`/advances/pending`, `/settlements/pending`) must be declared **before** the `/:id` route in each controller, otherwise NestJS will match `"pending"` as an id parameter.

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Returns `{ status: 'ok' }` for Render health checks |

### Swagger

Available at `GET /api/docs` in all environments.

---

## 5. Auth & Security

- **Registration:** bcrypt (10 rounds) password hashing
- **Login:** JWT signed with `{ sub: userId, email, role }`, configurable expiry
- **JwtAuthGuard:** validates Bearer token from `Authorization` header (Passport JWT strategy)
- **RolesGuard:** reads `@Roles()` metadata, compares `req.user.role`
- **`@CurrentUser()`:** custom param decorator extracting `req.user` from JWT payload

---

## 6. File Upload

- Multer with `memoryStorage` — files never written to disk
- `FilesInterceptor` on `POST /settlements` accepts multiple receipt files
- Validation: MIME type `image/*` or `application/pdf`, max 10MB per file
- `SettlementsService` uploads each buffer to Supabase Storage via `@supabase/supabase-js`
- Public URL stored in `SettlementExpense.receiptUrl`

### Multipart Form Strategy for `POST /settlements`

Mixing JSON arrays and files in `multipart/form-data` is not straightforward. The chosen strategy:

- **`expenses` field** — a single JSON string field containing the array: `[{ "expenseType": "Travel", "amount": 500 }, ...]`
- **`receipts` field** — multiple file fields using the same key name `receipts` (one per expense row, order-matched to the expenses array)
- The service parses `expenses` with `JSON.parse()`, validates it, then pairs each expense object with its corresponding file by array index.

---

## 7. DB Transactions

All approval/rejection/return actions use Prisma interactive transactions:

```typescript
await this.prisma.$transaction(async (tx) => {
  await tx.advanceRequest.update({ where: { id }, data: { status } });
  await tx.approvalLog.create({ data: { advanceRequestId: id, action, actorId, comments } });
});
```

If either write fails, the entire operation rolls back (ACID compliance).

---

## 8. Project Structure

```
advance-api/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── prisma.service.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   └── decorators/
│   │       ├── roles.decorator.ts
│   │       └── current-user.decorator.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── jwt.strategy.ts
│   │   └── dto/
│   │       ├── register.dto.ts
│   │       └── login.dto.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   └── users.service.ts
│   ├── advances/
│   │   ├── advances.module.ts
│   │   ├── advances.controller.ts
│   │   ├── advances.service.ts
│   │   └── dto/
│   │       ├── create-advance.dto.ts
│   │       └── approval-action.dto.ts
│   └── settlements/
│       ├── settlements.module.ts
│       ├── settlements.controller.ts
│       ├── settlements.service.ts
│       └── dto/
│           ├── create-settlement.dto.ts
│           └── settlement-action.dto.ts
├── .env.example
├── Dockerfile
├── render.yaml
└── package.json
```

---

## 9. Environment Variables

```
DATABASE_URL          # Supabase PostgreSQL connection string (pooling mode)
JWT_SECRET            # Secret for signing JWT tokens
JWT_EXPIRES_IN        # Token expiry e.g. "7d"
SUPABASE_URL          # Supabase project URL
SUPABASE_SERVICE_KEY  # Supabase service role key (bypasses RLS for storage)
SUPABASE_BUCKET       # Storage bucket name e.g. "receipts"
PORT                  # Server port (Render sets this automatically)
```

---

## 10. Deployment (Render)

- **Dockerfile** — multi-stage build: install deps → generate Prisma client → build → production image
- **render.yaml** — declares web service, env var references, health check path `/health`
- **Start command:** `npx prisma migrate deploy && node dist/main`
- Render PostgreSQL add-on or Supabase DB via `DATABASE_URL`
