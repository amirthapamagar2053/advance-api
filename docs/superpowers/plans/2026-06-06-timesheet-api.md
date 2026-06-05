# HR Timesheet Management API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone NestJS 11 REST API (`timesheet-api`) for employee timesheet submission and supervisor approval, mirroring the `advance-api` stack and conventions.

**Architecture:** Four modules — Auth, Users, Timesheets, Common — following exact patterns from `advance-api` at `/Users/amirthapamagar/Desktop/OJT/advance-api`. Date restriction and edit-lock logic live in `TimesheetsService`. Approval state changes use Prisma `$transaction`.

**Tech Stack:** NestJS 11, Prisma 7 + `@prisma/adapter-pg`, PostgreSQL (Supabase), JWT + Passport, `class-validator`, `@nestjs/swagger`, Jest + `ts-jest`

---

## File Map

```
timesheet-api/
├── src/
│   ├── auth/
│   │   ├── dto/login.dto.ts
│   │   ├── dto/register.dto.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   ├── auth.service.spec.ts
│   │   ├── auth.service.ts
│   │   └── jwt.strategy.ts
│   ├── common/
│   │   ├── decorators/current-user.decorator.ts
│   │   ├── decorators/roles.decorator.ts
│   │   ├── guards/jwt-auth.guard.ts
│   │   ├── guards/roles.guard.spec.ts
│   │   ├── guards/roles.guard.ts
│   │   ├── common.module.ts
│   │   ├── prisma.service.spec.ts
│   │   └── prisma.service.ts
│   ├── timesheets/
│   │   ├── dto/create-timesheet.dto.ts
│   │   ├── dto/return-timesheet.dto.ts
│   │   ├── dto/update-timesheet.dto.ts
│   │   ├── timesheets.controller.ts
│   │   ├── timesheets.module.ts
│   │   ├── timesheets.service.spec.ts
│   │   └── timesheets.service.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   └── users.service.ts
│   ├── app.module.ts
│   └── main.ts
├── prisma/schema.prisma
├── prisma.config.ts
├── .env
└── .env.example
```

---

## Task 1: Scaffold project and install dependencies

**Files:** entire `timesheet-api/` scaffold, updated `tsconfig.json`, `tsconfig.build.json`

- [ ] **Step 1: Scaffold**

```bash
cd /Users/amirthapamagar/Desktop/OJT
nest new timesheet-api --package-manager npm --skip-git
cd timesheet-api
```

Expected: project created, `npm install` completes without errors.

- [ ] **Step 2: Remove default boilerplate**

```bash
rm src/app.controller.ts src/app.controller.spec.ts src/app.service.ts
```

- [ ] **Step 3: Install additional dependencies**

```bash
npm install @nestjs/jwt @nestjs/passport @nestjs/config @nestjs/swagger
npm install passport passport-jwt bcrypt
npm install @prisma/client @prisma/adapter-pg pg
npm install class-validator class-transformer dotenv
npm install -D prisma @types/passport-jwt @types/bcrypt @types/pg
```

- [ ] **Step 4: Replace `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "resolvePackageJsonExports": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "noFallthroughCasesInSwitch": false
  }
}
```

- [ ] **Step 5: Replace `tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

- [ ] **Step 6: Commit**

```bash
git init && git add -A
git commit -m "feat: scaffold timesheet-api NestJS project"
```

---

## Task 2: Prisma schema and environment

**Files:** `prisma/schema.prisma`, `prisma.config.ts`, `.env`, `.env.example`

- [ ] **Step 1: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "postgresql"
}

enum Role {
  employee
  supervisor
}

enum TimesheetStatus {
  Draft
  Submitted
  Approved
  Returned
}

enum LeaveType {
  Sick_Leave
  Annual_Leave
  Emergency_Leave
}

model User {
  id                     String        @id @default(uuid())
  email                  String        @unique
  password               String
  name                   String
  role                   Role          @default(employee)
  supervisorId           String?
  supervisor             User?         @relation("SupervisorEmployees", fields: [supervisorId], references: [id])
  subordinates           User[]        @relation("SupervisorEmployees")
  timesheetsAsEmployee   Timesheet[]   @relation("EmployeeTimesheets")
  timesheetsAsSupervisor Timesheet[]   @relation("SupervisorTimesheets")
  approvalLogs           ApprovalLog[]
  createdAt              DateTime      @default(now())
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
  id          String    @id @default(uuid())
  timesheetId String
  timesheet   Timesheet @relation(fields: [timesheetId], references: [id])
  action      String
  actorId     String
  actor       User      @relation(fields: [actorId], references: [id])
  comments    String?
  createdAt   DateTime  @default(now())
}
```

- [ ] **Step 2: Write `prisma.config.ts`**

```typescript
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

- [ ] **Step 3: Create `.env.example`**

```
DATABASE_URL=postgresql://postgres.PROJECTID:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgBouncer=true&connection_limit=1
JWT_SECRET=replace-with-a-long-random-secret-min-32-chars
JWT_EXPIRES_IN=7d
PORT=3001
```

- [ ] **Step 4: Create `.env` — fill in real Supabase credentials**

Copy `.env.example` to `.env` and replace placeholder values. Confirm `.env` is in `.gitignore`.

- [ ] **Step 5: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected output includes: `Your database is now in sync with your schema.`

- [ ] **Step 6: Commit**

```bash
git add prisma/ prisma.config.ts .env.example
git commit -m "feat: add Prisma schema (User, Timesheet, ApprovalLog) and run init migration"
```

---

## Task 3: CommonModule

**Files:** `src/common/prisma.service.ts`, `src/common/prisma.service.spec.ts`, `src/common/guards/jwt-auth.guard.ts`, `src/common/guards/roles.guard.ts`, `src/common/guards/roles.guard.spec.ts`, `src/common/decorators/current-user.decorator.ts`, `src/common/decorators/roles.decorator.ts`, `src/common/common.module.ts`

- [ ] **Step 1: Write failing test — `src/common/prisma.service.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { ConfigService } from '@nestjs/config';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn().mockImplementation(() => ({})) }));
jest.mock('pg', () => ({ Pool: jest.fn().mockImplementation(() => ({})) }));

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('postgresql://mock:5432/db') } },
      ],
    }).compile();
    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- --testPathPattern=prisma.service.spec
```

Expected: FAIL — `Cannot find module './prisma.service'`

- [ ] **Step 3: Write `src/common/prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    const pool = new Pool({ connectionString: config.get<string>('DATABASE_URL') });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test -- --testPathPattern=prisma.service.spec
```

- [ ] **Step 5: Write failing test — `src/common/guards/roles.guard.spec.ts`**

```typescript
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

const mockContext = (role: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext);

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => { reflector = new Reflector(); guard = new RolesGuard(reflector); });

  it('allows access when no roles required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext('employee'))).toBe(true);
  });

  it('allows access when role matches', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['supervisor']);
    expect(guard.canActivate(mockContext('supervisor'))).toBe(true);
  });

  it('denies access when role does not match', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['supervisor']);
    expect(guard.canActivate(mockContext('employee'))).toBe(false);
  });
});
```

- [ ] **Step 6: Run — expect FAIL**

```bash
npm test -- --testPathPattern=roles.guard.spec
```

- [ ] **Step 7: Write `src/common/decorators/roles.decorator.ts`**

```typescript
import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 8: Write `src/common/guards/roles.guard.ts`**

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user?.role);
  }
}
```

- [ ] **Step 9: Write `src/common/guards/jwt-auth.guard.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 10: Write `src/common/decorators/current-user.decorator.ts`**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);
```

- [ ] **Step 11: Run guard test — expect PASS**

```bash
npm test -- --testPathPattern=roles.guard.spec
```

- [ ] **Step 12: Write `src/common/common.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class CommonModule {}
```

- [ ] **Step 13: Commit**

```bash
git add src/common/
git commit -m "feat: add CommonModule with PrismaService, JwtAuthGuard, RolesGuard, decorators"
```

---

## Task 4: UsersModule

**Files:** `src/users/users.service.ts`, `src/users/users.module.ts`

- [ ] **Step 1: Write `src/users/users.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Role, User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: { email: string; password: string; name: string; role?: Role; supervisorId?: string }): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
```

- [ ] **Step 2: Write `src/users/users.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

@Module({ providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
```

- [ ] **Step 3: Commit**

```bash
git add src/users/
git commit -m "feat: add UsersModule with supervisorId support in create()"
```

---

## Task 5: AuthModule

**Files:** `src/auth/dto/register.dto.ts`, `src/auth/dto/login.dto.ts`, `src/auth/jwt.strategy.ts`, `src/auth/auth.service.spec.ts`, `src/auth/auth.service.ts`, `src/auth/auth.controller.ts`, `src/auth/auth.module.ts`

- [ ] **Step 1: Write `src/auth/dto/register.dto.ts`**

```typescript
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'Alice Cruz' }) @IsString() name: string;
  @ApiProperty({ example: 'alice@company.com' }) @IsEmail() email: string;
  @ApiProperty({ example: 'secret123', minLength: 6 }) @IsString() @MinLength(6) password: string;
  @ApiProperty({ enum: Role, default: Role.employee }) @IsEnum(Role) role: Role;
  @ApiPropertyOptional({ example: 'uuid-of-supervisor' }) @IsOptional() @IsUUID() supervisorId?: string;
}
```

- [ ] **Step 2: Write `src/auth/dto/login.dto.ts`**

```typescript
import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'alice@company.com' }) @IsEmail() email: string;
  @ApiProperty({ example: 'secret123' }) @IsString() password: string;
}
```

- [ ] **Step 3: Write `src/auth/jwt.strategy.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET is not set');
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: secret });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
```

- [ ] **Step 4: Write failing test — `src/auth/auth.service.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockUsers = { findByEmail: jest.fn(), create: jest.fn() };
const mockJwt = { sign: jest.fn().mockReturnValue('mock-token') };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsers },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('throws ConflictException when email already exists', async () => {
      mockUsers.findByEmail.mockResolvedValue({ id: '1' });
      await expect(
        service.register({ name: 'A', email: 'a@b.com', password: '123456', role: 'employee' as any }),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes password and returns user without password field', async () => {
      mockUsers.findByEmail.mockResolvedValue(null);
      mockUsers.create.mockResolvedValue({ id: '1', email: 'a@b.com', role: 'employee', name: 'A' });
      const result = await service.register({ name: 'A', email: 'a@b.com', password: '123456', role: 'employee' as any });
      expect(result).toEqual({ id: '1', email: 'a@b.com', role: 'employee' });
      expect(result).not.toHaveProperty('password');
      expect(mockUsers.create.mock.calls[0][0].password).not.toBe('123456');
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for unknown email', async () => {
      mockUsers.findByEmail.mockResolvedValue(null);
      await expect(service.login({ email: 'x@b.com', password: '123456' })).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      mockUsers.findByEmail.mockResolvedValue({ id: '1', email: 'a@b.com', password: hashed, role: 'employee' });
      await expect(service.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow(UnauthorizedException);
    });

    it('returns access_token on valid credentials', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      mockUsers.findByEmail.mockResolvedValue({ id: '1', email: 'a@b.com', password: hashed, role: 'employee' });
      const result = await service.login({ email: 'a@b.com', password: 'correct' });
      expect(result).toEqual({ access_token: 'mock-token' });
      expect(mockJwt.sign).toHaveBeenCalledWith({ sub: '1', email: 'a@b.com', role: 'employee' });
    });
  });
});
```

- [ ] **Step 5: Run — expect FAIL**

```bash
npm test -- --testPathPattern=auth.service.spec
```

- [ ] **Step 6: Write `src/auth/auth.service.ts`**

```typescript
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');
    const password = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({ ...dto, password });
    return { id: user.id, email: user.email, role: user.role };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    const token = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return { access_token: token };
  }
}
```

- [ ] **Step 7: Run — expect PASS**

```bash
npm test -- --testPathPattern=auth.service.spec
```

Expected: PASS — 4 tests.

- [ ] **Step 8: Write `src/auth/auth.controller.ts`**

```typescript
import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201 }) @ApiResponse({ status: 409, description: 'Email already in use' })
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive JWT access token' })
  @ApiResponse({ status: 200 }) @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) { return this.auth.login(dto); }
}
```

- [ ] **Step 9: Write `src/auth/auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') as any },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

- [ ] **Step 10: Commit**

```bash
git add src/auth/
git commit -m "feat: add AuthModule with JWT login/register and optional supervisorId"
```

---

## Task 6: main.ts and AppModule

**Files:** `src/main.ts`, `src/app.module.ts`

- [ ] **Step 1: Write `src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Timesheet Management API')
    .setDescription('REST API for the HR Timesheet Management System. Authenticate via POST /auth/login to get a Bearer token, then click Authorize.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3001);
  console.log(`Application running on: ${await app.getUrl()}`);
  console.log(`Swagger docs available at: ${await app.getUrl()}/api/docs`);
}

bootstrap();
```

- [ ] **Step 2: Write `src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
```

(TimesheetsModule added in Task 10.)

- [ ] **Step 3: Verify app starts**

```bash
npm run start:dev
```

Expected output includes:
```
Application running on: http://[::1]:3001
Swagger docs available at: http://[::1]:3001/api/docs
```

Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts src/app.module.ts
git commit -m "feat: configure Swagger, global ValidationPipe, port 3001"
```

---

## Task 7: Timesheets DTOs

**Files:** `src/timesheets/dto/create-timesheet.dto.ts`, `src/timesheets/dto/update-timesheet.dto.ts`, `src/timesheets/dto/return-timesheet.dto.ts`

- [ ] **Step 1: Write `src/timesheets/dto/create-timesheet.dto.ts`**

```typescript
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { LeaveType } from '@prisma/client';

export class CreateTimesheetDto {
  @ApiProperty({ example: '2026-06-06', description: 'Date of work (not future, not >7 days past)' })
  @IsDateString()
  recordDate: string;

  @ApiProperty({ example: 'Developed login feature and wrote unit tests' })
  @IsString() @IsNotEmpty()
  taskDescription: string;

  @ApiProperty({ example: 8.0, minimum: 0.01, maximum: 24 })
  @Type(() => Number) @IsNumber() @Min(0.01) @Max(24)
  hoursWorked: number;

  @ApiPropertyOptional({ example: 'Engineering' })
  @IsOptional() @IsString()
  projectDepartment?: string;

  @ApiPropertyOptional({ enum: LeaveType })
  @IsOptional() @IsEnum(LeaveType)
  leaveType?: LeaveType;

  @ApiPropertyOptional({ example: 'Worked from home today' })
  @IsOptional() @IsString()
  remarks?: string;
}
```

- [ ] **Step 2: Write `src/timesheets/dto/update-timesheet.dto.ts`**

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateTimesheetDto } from './create-timesheet.dto';

export class UpdateTimesheetDto extends PartialType(CreateTimesheetDto) {}
```

- [ ] **Step 3: Write `src/timesheets/dto/return-timesheet.dto.ts`**

```typescript
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReturnTimesheetDto {
  @ApiProperty({ example: 'Please add more detail to the task description' })
  @IsString() @IsNotEmpty()
  comments: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/timesheets/dto/
git commit -m "feat: add timesheet DTOs (CreateTimesheetDto, UpdateTimesheetDto, ReturnTimesheetDto)"
```

---

## Task 8: TimesheetsService — employee methods + spec

**Files:** `src/timesheets/timesheets.service.ts`, `src/timesheets/timesheets.service.spec.ts`

- [ ] **Step 1: Write failing tests (employee section) — `src/timesheets/timesheets.service.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { TimesheetsService } from './timesheets.service';
import { PrismaService } from '../common/prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TimesheetStatus } from '@prisma/client';

const mockPrisma = {
  $transaction: jest.fn(),
  user: { findUnique: jest.fn() },
  timesheet: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  approvalLog: { create: jest.fn() },
};

describe('TimesheetsService', () => {
  let service: TimesheetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimesheetsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<TimesheetsService>(TimesheetsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create — date restriction', () => {
    it('throws BadRequestException for a future date', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'emp1', supervisorId: 'sup1' });
      const future = new Date(); future.setDate(future.getDate() + 1);
      await expect(
        service.create('emp1', { recordDate: future.toISOString().split('T')[0], taskDescription: 'work', hoursWorked: 8 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for date more than 7 days in the past', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'emp1', supervisorId: 'sup1' });
      const old = new Date(); old.setDate(old.getDate() - 8);
      await expect(
        service.create('emp1', { recordDate: old.toISOString().split('T')[0], taskDescription: 'work', hoursWorked: 8 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when employee has no supervisor', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'emp1', supervisorId: null });
      const today = new Date().toISOString().split('T')[0];
      await expect(
        service.create('emp1', { recordDate: today, taskDescription: 'work', hoursWorked: 8 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates timesheet for today with supervisorId from employee profile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'emp1', supervisorId: 'sup1' });
      mockPrisma.timesheet.create.mockResolvedValue({ id: 'ts1', status: 'Draft' });
      const today = new Date().toISOString().split('T')[0];
      const result = await service.create('emp1', { recordDate: today, taskDescription: 'Feature X', hoursWorked: 8 });
      expect(result.status).toBe('Draft');
      expect(mockPrisma.timesheet.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ employeeId: 'emp1', supervisorId: 'sup1' }) }),
      );
    });
  });

  describe('findOwn', () => {
    it('returns all timesheets for the employee', async () => {
      mockPrisma.timesheet.findMany.mockResolvedValue([{ id: 'ts1' }, { id: 'ts2' }]);
      const result = await service.findOwn('emp1');
      expect(result).toHaveLength(2);
      expect(mockPrisma.timesheet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { employeeId: 'emp1' } }),
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when timesheet does not exist', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue(null);
      await expect(service.update('bad', 'emp1', { taskDescription: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when employee is not the owner', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue({ id: 'ts1', employeeId: 'other', status: TimesheetStatus.Draft });
      await expect(service.update('ts1', 'emp1', {})).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when status is Submitted', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue({ id: 'ts1', employeeId: 'emp1', status: TimesheetStatus.Submitted });
      await expect(service.update('ts1', 'emp1', {})).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when status is Approved', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue({ id: 'ts1', employeeId: 'emp1', status: TimesheetStatus.Approved });
      await expect(service.update('ts1', 'emp1', {})).rejects.toThrow(ForbiddenException);
    });

    it('updates timesheet when status is Draft', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue({ id: 'ts1', employeeId: 'emp1', status: TimesheetStatus.Draft });
      mockPrisma.timesheet.update.mockResolvedValue({ id: 'ts1', taskDescription: 'updated', status: TimesheetStatus.Draft });
      const result = await service.update('ts1', 'emp1', { taskDescription: 'updated' });
      expect(result.taskDescription).toBe('updated');
    });

    it('updates timesheet when status is Returned', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue({ id: 'ts1', employeeId: 'emp1', status: TimesheetStatus.Returned });
      mockPrisma.timesheet.update.mockResolvedValue({ id: 'ts1', status: TimesheetStatus.Returned });
      await expect(service.update('ts1', 'emp1', { remarks: 'added detail' })).resolves.toBeDefined();
    });
  });

  describe('submit', () => {
    it('throws NotFoundException when timesheet does not exist', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue(null);
      await expect(service.submit('bad', 'emp1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when employee is not the owner', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue({ id: 'ts1', employeeId: 'other', status: TimesheetStatus.Draft });
      await expect(service.submit('ts1', 'emp1')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when status is not Draft', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue({ id: 'ts1', employeeId: 'emp1', status: TimesheetStatus.Submitted });
      await expect(service.submit('ts1', 'emp1')).rejects.toThrow(BadRequestException);
    });

    it('updates status to Submitted', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue({ id: 'ts1', employeeId: 'emp1', status: TimesheetStatus.Draft });
      mockPrisma.timesheet.update.mockResolvedValue({ id: 'ts1', status: TimesheetStatus.Submitted });
      const result = await service.submit('ts1', 'emp1');
      expect(result.status).toBe(TimesheetStatus.Submitted);
    });
  });

  // Supervisor tests added in Task 9
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- --testPathPattern=timesheets.service.spec
```

- [ ] **Step 3: Write `src/timesheets/timesheets.service.ts`**

```typescript
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TimesheetStatus } from '@prisma/client';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { UpdateTimesheetDto } from './dto/update-timesheet.dto';
import { ReturnTimesheetDto } from './dto/return-timesheet.dto';

@Injectable()
export class TimesheetsService {
  constructor(private prisma: PrismaService) {}

  private validateDateRestriction(recordDate: string): void {
    const date = new Date(recordDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    if (date > today) throw new BadRequestException('Timesheet entries cannot be for future dates');
    if (date < sevenDaysAgo) throw new BadRequestException('Timesheet entries cannot be more than 7 days in the past');
  }

  async create(employeeId: string, dto: CreateTimesheetDto) {
    this.validateDateRestriction(dto.recordDate);
    const employee = await this.prisma.user.findUnique({ where: { id: employeeId } });
    if (!employee?.supervisorId) throw new BadRequestException('Employee does not have an assigned supervisor');
    return this.prisma.timesheet.create({
      data: {
        employeeId,
        supervisorId: employee.supervisorId,
        recordDate: new Date(dto.recordDate),
        taskDescription: dto.taskDescription,
        hoursWorked: dto.hoursWorked,
        projectDepartment: dto.projectDepartment,
        leaveType: dto.leaveType,
        remarks: dto.remarks,
      },
    });
  }

  findOwn(employeeId: string) {
    return this.prisma.timesheet.findMany({ where: { employeeId }, orderBy: { recordDate: 'desc' } });
  }

  async update(id: string, employeeId: string, dto: UpdateTimesheetDto) {
    const timesheet = await this.prisma.timesheet.findUnique({ where: { id } });
    if (!timesheet) throw new NotFoundException('Timesheet not found');
    if (timesheet.employeeId !== employeeId) throw new ForbiddenException();
    if (timesheet.status === TimesheetStatus.Approved || timesheet.status === TimesheetStatus.Submitted) {
      throw new ForbiddenException('Cannot edit an Approved or Submitted timesheet');
    }
    if (dto.recordDate) this.validateDateRestriction(dto.recordDate);
    return this.prisma.timesheet.update({
      where: { id },
      data: { ...dto, recordDate: dto.recordDate ? new Date(dto.recordDate) : undefined },
    });
  }

  async submit(id: string, employeeId: string) {
    const timesheet = await this.prisma.timesheet.findUnique({ where: { id } });
    if (!timesheet) throw new NotFoundException('Timesheet not found');
    if (timesheet.employeeId !== employeeId) throw new ForbiddenException();
    if (timesheet.status !== TimesheetStatus.Draft) throw new BadRequestException('Only Draft timesheets can be submitted');
    return this.prisma.timesheet.update({ where: { id }, data: { status: TimesheetStatus.Submitted } });
  }

  findPending(_supervisorId: string): Promise<any[]> { return Promise.resolve([]); }
  findOne(_id: string): Promise<any> { return Promise.resolve(null); }
  approve(_id: string, _actorId: string): Promise<any> { return Promise.resolve(null); }
  returnTimesheet(_id: string, _actorId: string, _dto: ReturnTimesheetDto): Promise<any> { return Promise.resolve(null); }
}
```

- [ ] **Step 4: Run — expect employee tests PASS**

```bash
npm test -- --testPathPattern=timesheets.service.spec
```

- [ ] **Step 5: Commit**

```bash
git add src/timesheets/timesheets.service.ts src/timesheets/timesheets.service.spec.ts
git commit -m "feat: add TimesheetsService employee methods with TDD (create, findOwn, update, submit)"
```

---

## Task 9: TimesheetsService — supervisor methods

**Files:** Modify `src/timesheets/timesheets.service.spec.ts`, modify `src/timesheets/timesheets.service.ts`

- [ ] **Step 1: Add supervisor tests to `timesheets.service.spec.ts` — insert before the final closing `});`**

```typescript
  describe('findPending', () => {
    it('returns only Submitted timesheets filtered by supervisorId', async () => {
      mockPrisma.timesheet.findMany.mockResolvedValue([{ id: 'ts1', status: 'Submitted' }]);
      const result = await service.findPending('sup1');
      expect(result).toHaveLength(1);
      expect(mockPrisma.timesheet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { supervisorId: 'sup1', status: TimesheetStatus.Submitted } }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when timesheet does not exist', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad')).rejects.toThrow(NotFoundException);
    });

    it('returns timesheet with employee, supervisor, and approval logs', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue({
        id: 'ts1',
        employee: { id: 'emp1', name: 'Alice', email: 'a@b.com' },
        supervisor: { id: 'sup1', name: 'Bob', email: 'b@b.com' },
        approvalLogs: [],
      });
      const result = await service.findOne('ts1');
      expect(result.employee.name).toBe('Alice');
    });
  });

  describe('approve', () => {
    it('throws NotFoundException when timesheet does not exist', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue(null);
      await expect(service.approve('bad', 'sup1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not the assigned supervisor', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue({ id: 'ts1', supervisorId: 'other', status: TimesheetStatus.Submitted });
      await expect(service.approve('ts1', 'sup1')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when status is not Submitted', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue({ id: 'ts1', supervisorId: 'sup1', status: TimesheetStatus.Draft });
      await expect(service.approve('ts1', 'sup1')).rejects.toThrow(BadRequestException);
    });

    it('runs transaction: sets Approved status and inserts ApprovalLog', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue({ id: 'ts1', supervisorId: 'sup1', status: TimesheetStatus.Submitted });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.timesheet.update.mockResolvedValue({ id: 'ts1', status: TimesheetStatus.Approved });
      mockPrisma.approvalLog.create.mockResolvedValue({});
      const result = await service.approve('ts1', 'sup1');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.approvalLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'Approved', actorId: 'sup1', timesheetId: 'ts1' }) }),
      );
      expect(result.status).toBe(TimesheetStatus.Approved);
    });
  });

  describe('returnTimesheet', () => {
    it('throws NotFoundException when timesheet does not exist', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue(null);
      await expect(service.returnTimesheet('bad', 'sup1', { comments: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not the assigned supervisor', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue({ id: 'ts1', supervisorId: 'other', status: TimesheetStatus.Submitted });
      await expect(service.returnTimesheet('ts1', 'sup1', { comments: 'x' })).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when status is not Submitted', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue({ id: 'ts1', supervisorId: 'sup1', status: TimesheetStatus.Draft });
      await expect(service.returnTimesheet('ts1', 'sup1', { comments: 'x' })).rejects.toThrow(BadRequestException);
    });

    it('runs transaction: sets Returned status and inserts ApprovalLog with comments', async () => {
      mockPrisma.timesheet.findUnique.mockResolvedValue({ id: 'ts1', supervisorId: 'sup1', status: TimesheetStatus.Submitted });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.timesheet.update.mockResolvedValue({ id: 'ts1', status: TimesheetStatus.Returned });
      mockPrisma.approvalLog.create.mockResolvedValue({});
      const result = await service.returnTimesheet('ts1', 'sup1', { comments: 'Please add detail' });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.approvalLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'Returned', actorId: 'sup1', comments: 'Please add detail' }) }),
      );
      expect(result.status).toBe(TimesheetStatus.Returned);
    });
  });
```

- [ ] **Step 2: Run — expect supervisor tests FAIL (stubs)**

```bash
npm test -- --testPathPattern=timesheets.service.spec
```

- [ ] **Step 3: Replace the four stub methods at the bottom of `timesheets.service.ts`**

```typescript
  findPending(supervisorId: string) {
    return this.prisma.timesheet.findMany({
      where: { supervisorId, status: TimesheetStatus.Submitted },
      include: { employee: { select: { id: true, name: true, email: true } } },
      orderBy: { recordDate: 'asc' },
    });
  }

  async findOne(id: string) {
    const timesheet = await this.prisma.timesheet.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        supervisor: { select: { id: true, name: true, email: true } },
        approvalLogs: {
          include: { actor: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!timesheet) throw new NotFoundException('Timesheet not found');
    return timesheet;
  }

  async approve(id: string, actorId: string) {
    const timesheet = await this.prisma.timesheet.findUnique({ where: { id } });
    if (!timesheet) throw new NotFoundException('Timesheet not found');
    if (timesheet.supervisorId !== actorId) throw new ForbiddenException();
    if (timesheet.status !== TimesheetStatus.Submitted) throw new BadRequestException('Only Submitted timesheets can be approved');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.timesheet.update({ where: { id }, data: { status: TimesheetStatus.Approved } });
      await tx.approvalLog.create({ data: { timesheetId: id, action: 'Approved', actorId } });
      return updated;
    });
  }

  async returnTimesheet(id: string, actorId: string, dto: ReturnTimesheetDto) {
    const timesheet = await this.prisma.timesheet.findUnique({ where: { id } });
    if (!timesheet) throw new NotFoundException('Timesheet not found');
    if (timesheet.supervisorId !== actorId) throw new ForbiddenException();
    if (timesheet.status !== TimesheetStatus.Submitted) throw new BadRequestException('Only Submitted timesheets can be returned');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.timesheet.update({ where: { id }, data: { status: TimesheetStatus.Returned } });
      await tx.approvalLog.create({ data: { timesheetId: id, action: 'Returned', actorId, comments: dto.comments } });
      return updated;
    });
  }
```

- [ ] **Step 4: Run all tests — expect all PASS**

```bash
npm test
```

Expected: all test suites pass.

- [ ] **Step 5: Commit**

```bash
git add src/timesheets/timesheets.service.ts src/timesheets/timesheets.service.spec.ts
git commit -m "feat: add TimesheetsService supervisor methods (findPending, findOne, approve, return)"
```

---

## Task 10: TimesheetsController, TimesheetsModule, AppModule wiring

**Files:** `src/timesheets/timesheets.controller.ts`, `src/timesheets/timesheets.module.ts`, modify `src/app.module.ts`

- [ ] **Step 1: Write `src/timesheets/timesheets.controller.ts`**

```typescript
import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TimesheetsService } from './timesheets.service';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { UpdateTimesheetDto } from './dto/update-timesheet.dto';
import { ReturnTimesheetDto } from './dto/return-timesheet.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('timesheets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('timesheets')
export class TimesheetsController {
  constructor(private timesheets: TimesheetsService) {}

  @Post()
  @Roles('employee')
  @ApiOperation({ summary: 'Create a new Draft timesheet entry' })
  @ApiResponse({ status: 201 })
  create(@CurrentUser() user: any, @Body() dto: CreateTimesheetDto) {
    return this.timesheets.create(user.id, dto);
  }

  @Get()
  @Roles('employee')
  @ApiOperation({ summary: "List the authenticated employee's own timesheet records" })
  findOwn(@CurrentUser() user: any) {
    return this.timesheets.findOwn(user.id);
  }

  // IMPORTANT: 'pending' MUST be declared BEFORE ':id' to avoid route collision
  @Get('pending')
  @Roles('supervisor')
  @ApiOperation({ summary: "List Submitted timesheets for supervisor's direct reports" })
  findPending(@CurrentUser() user: any) {
    return this.timesheets.findPending(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full detail of a single timesheet' })
  findOne(@Param('id') id: string) {
    return this.timesheets.findOne(id);
  }

  @Put(':id')
  @Roles('employee')
  @ApiOperation({ summary: 'Edit a Draft or Returned timesheet' })
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateTimesheetDto) {
    return this.timesheets.update(id, user.id, dto);
  }

  @Put(':id/submit')
  @Roles('employee')
  @ApiOperation({ summary: 'Submit a Draft timesheet — locks it pending approval' })
  submit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.timesheets.submit(id, user.id);
  }

  @Put(':id/approve')
  @Roles('supervisor')
  @ApiOperation({ summary: 'Approve a Submitted timesheet' })
  approve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.timesheets.approve(id, user.id);
  }

  @Put(':id/return')
  @Roles('supervisor')
  @ApiOperation({ summary: 'Return a Submitted timesheet with remarks (comments required)' })
  returnTimesheet(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ReturnTimesheetDto) {
    return this.timesheets.returnTimesheet(id, user.id, dto);
  }
}
```

- [ ] **Step 2: Write `src/timesheets/timesheets.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetsService } from './timesheets.service';

@Module({ controllers: [TimesheetsController], providers: [TimesheetsService] })
export class TimesheetsModule {}
```

- [ ] **Step 3: Add TimesheetsModule to `src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TimesheetsModule } from './timesheets/timesheets.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    UsersModule,
    AuthModule,
    TimesheetsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Run all tests — confirm nothing broke**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/timesheets/timesheets.controller.ts src/timesheets/timesheets.module.ts src/app.module.ts
git commit -m "feat: add TimesheetsController and wire into AppModule"
```

---

## Task 11: Final verification

- [ ] **Step 1: Start the dev server**

```bash
npm run start:dev
```

Expected:
```
Application running on: http://[::1]:3001
Swagger docs available at: http://[::1]:3001/api/docs
```

- [ ] **Step 2: Verify Swagger UI at `http://localhost:3001/api/docs`**

Expected: two tag sections — **auth** (register, login) and **timesheets** (8 endpoints). Bearer auth button present.

- [ ] **Step 3: Smoke test via Swagger**

1. `POST /auth/register` — create supervisor: `{ "name": "Bob Sup", "email": "bob@test.com", "password": "secret123", "role": "supervisor" }` → copy `id`
2. `POST /auth/register` — create employee: `{ "name": "Alice Emp", "email": "alice@test.com", "password": "secret123", "role": "employee", "supervisorId": "<bob-id>" }`
3. `POST /auth/login` as Alice → copy `access_token` → click **Authorize**
4. `POST /timesheets` with today's date → expect `201`, `status: "Draft"`
5. `PUT /timesheets/:id/submit` → expect `status: "Submitted"`
6. Login as Bob, `GET /timesheets/pending` → Alice's timesheet visible
7. `PUT /timesheets/:id/approve` as Bob → expect `status: "Approved"`

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected:
```
Test Suites: 4 passed, 4 total
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete timesheet-api — all modules wired, tests passing, Swagger verified"
```
