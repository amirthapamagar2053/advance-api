# HR Timesheet Management API — Design Spec

**Date:** 2026-06-06
**Project:** `timesheet-api`
**Location:** `/Users/amirthapamagar/Desktop/OJT/timesheet-api`
**Stack:** NestJS 11, Prisma 7, PostgreSQL, JWT/Passport, Swagger

---

## 1. Overview

A standalone REST API that handles two user workflows:

1. **Employee Workflow** — fill out, edit, and submit daily timesheet records with strict date policy enforcement.
2. **Supervisor Workflow** — review, approve, or return submitted timesheets from direct reports, with an audit trail.

The project mirrors the `advance-api` conventions (same stack, same folder layout, same auth pattern) for consistency across the OJT codebase.

---

## 2. Architecture

```
timesheet-api/
├── src/
│   ├── auth/               # JWT login/register
│   ├── users/              # User CRUD, supervisor assignment
│   ├── timesheets/         # Employee + supervisor endpoints
│   ├── common/             # PrismaService, guards, decorators
│   ├── app.module.ts
│   └── main.ts
├── prisma/
│   └── schema.prisma
├── test/
├── nest-cli.json
├── tsconfig.json
└── package.json
```

**Module responsibilities:**

| Module | Responsibility |
|---|---|
| `AuthModule` | Register, login, issue JWT |
| `UsersModule` | Manage users and supervisor assignments |
| `TimesheetsModule` | All timesheet CRUD + approval flow |
| `CommonModule` | `PrismaService`, `JwtAuthGuard`, `RolesGuard`, `@CurrentUser()` decorator |

---

## 3. Data Schema (Prisma / PostgreSQL)

```prisma
enum Role {
  employee
  supervisor
}

enum LeaveType {
  Sick_Leave
  Annual_Leave
  Emergency_Leave
}

enum TimesheetStatus {
  Draft
  Submitted
  Approved
  Returned
}

model User {
  id                  String      @id @default(uuid())
  email               String      @unique
  password            String
  name                String
  role                Role        @default(employee)
  supervisorId        String?
  supervisor          User?       @relation("SupervisorEmployees", fields: [supervisorId], references: [id])
  subordinates        User[]      @relation("SupervisorEmployees")
  timesheetsAsEmployee Timesheet[] @relation("EmployeeTimesheets")
  timesheetsAsSupervisor Timesheet[] @relation("SupervisorTimesheets")
  approvalLogs        ApprovalLog[]
  createdAt           DateTime    @default(now())
}

model Timesheet {
  id                String          @id @default(uuid())
  employeeId        String
  employee          User            @relation("EmployeeTimesheets", fields: [employeeId], references: [id])
  supervisorId      String
  supervisor        User            @relation("SupervisorTimesheets", fields: [supervisorId], references: [id])
  recordDate        DateTime        @db.Date
  projectDepartment String?         @db.VarChar(100)
  taskDescription   String
  hoursWorked       Decimal         @db.Decimal(4, 2)
  leaveType         LeaveType?
  remarks           String?
  status            TimesheetStatus @default(Draft)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  approvalLogs      ApprovalLog[]
}

model ApprovalLog {
  id           String    @id @default(uuid())
  timesheetId  String
  timesheet    Timesheet @relation(fields: [timesheetId], references: [id])
  action       String
  actorId      String
  actor        User      @relation(fields: [actorId], references: [id])
  comments     String?
  createdAt    DateTime  @default(now())
}
```

---

## 4. API Endpoints

### Auth

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password, name, role, supervisorId? }` | Register a user |
| POST | `/auth/login` | `{ email, password }` | Returns JWT Bearer token |

### Employee Endpoints (`role: employee`)

| Method | Path | Description |
|---|---|---|
| GET | `/timesheets` | Fetch own timesheet records (supports `?month=&year=` query params) |
| POST | `/timesheets` | Create a new Draft timesheet |
| PUT | `/timesheets/:id` | Edit a timesheet (only if status is `Draft` or `Returned`) |
| PUT | `/timesheets/:id/submit` | Submit timesheet → status becomes `Submitted` (locked) |

### Supervisor Endpoints (`role: supervisor`)

| Method | Path | Description |
|---|---|---|
| GET | `/timesheets/pending` | Fetch `Submitted` timesheets for direct reports only (`WHERE supervisorId = req.user.id`) |
| GET | `/timesheets/:id` | Fetch full detail of a single timesheet |
| PUT | `/timesheets/:id/approve` | Approve → status `Approved`, insert `ApprovalLog` |
| PUT | `/timesheets/:id/return` | Return → status `Returned`, requires `comments`, insert `ApprovalLog` |

---

## 5. Business Rules

### Date Restriction Middleware
- Applied to `POST /timesheets` and `PUT /timesheets/:id`.
- Rejects `recordDate` that is **more than 7 days in the past** or **any future date**.
- Returns `400 Bad Request` with a descriptive message.

### Edit Lock
- `PUT /timesheets/:id` returns `403 Forbidden` if current status is `Approved` or `Submitted`.
- Only `Draft` and `Returned` records are editable.

### Access Control
- All routes require a valid JWT (`JwtAuthGuard`).
- `POST/PUT /timesheets` validates that `req.user.id === timesheet.employeeId`.
- `GET /timesheets/pending`, `PUT /:id/approve`, `PUT /:id/return` validate `req.user.id === timesheet.supervisorId`.
- `RolesGuard` enforces `employee` vs `supervisor` role separation on the route level.

### Approval Transaction
When a supervisor approves or returns a timesheet, a Prisma `$transaction` executes:
1. `UPDATE timesheets SET status = ... WHERE id = ... AND supervisorId = ...`
2. `INSERT INTO approval_logs (timesheetId, action, actorId, comments)`

---

## 6. Validation (DTOs)

| DTO | Fields |
|---|---|
| `CreateTimesheetDto` | `recordDate` (required), `taskDescription` (required), `hoursWorked` (required, 0.01–24), `projectDepartment?`, `leaveType?`, `remarks?` |
| `UpdateTimesheetDto` | All fields optional (PartialType of CreateTimesheetDto) |
| `ReturnTimesheetDto` | `comments` (required) |
| `RegisterDto` | `email`, `password`, `name`, `role`, `supervisorId?` |
| `LoginDto` | `email`, `password` |

All DTOs use `class-validator` decorators. Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`.

---

## 7. Swagger

- Available at `/api/docs`
- Bearer auth configured via `DocumentBuilder.addBearerAuth()`
- All endpoints tagged by module (`Auth`, `Timesheets`)
- DTOs annotated with `@ApiProperty()`

---

## 8. Project Bootstrap

```bash
nest new timesheet-api
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install @prisma/client @prisma/adapter-pg pg
npm install class-validator class-transformer
npm install @nestjs/swagger
npm install -D prisma @types/passport-jwt
```

Port: `3001` (advance-api uses 3000)

---

## 9. Out of Scope

- Email/notification sending (stub the method, log to console)
- File uploads or receipt handling
- Pagination beyond basic query filters
- Admin role
