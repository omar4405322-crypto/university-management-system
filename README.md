# University Management System (UMS)

A production-grade, multi-tenant university management and academic operations platform built with React 18, Express 5, Prisma ORM, PostgreSQL, and Redis.

---

## 1. Project Overview

The University Management System powers comprehensive academic administration, attendance tracking, scheduling, grading, and student self-service.

### Key Capabilities & Roles
- **System Administration (`SUPER_ADMIN` / `ADMIN`):** Multi-tenant college and department administration, global academic calendars, operational metrics, and role provisioning.
- **College & Department Administration (`COLLEGE_ADMIN` / `DEPARTMENT_ADMIN`):** Department-level course scheduling, timetable conflict resolution, faculty allocations, and academic warning reviews.
- **Faculty & Academic Staff (`DOCTOR` / `TEACHING_ASSISTANT`):** Course management, interactive attendance tracking (QR code scanning, geofenced GPS, RFID smart cards), assignment creation, and grade submission.
- **Student Portal (`STUDENT`):** Course registration, personalized timetables, attendance history, homework submissions, timed online quizzes/exams, and academic transcripts.

---

## 2. Architecture & Technology Stack

The platform is built as a hardened, multi-container system:

```mermaid
graph LR
    Web["Client / Browser (React 18 + Vite)"]
    Nginx["Reverse Proxy (Nginx)"]
    API["API Cluster (Node.js 20+ / Express 5)"]
    DB[("PostgreSQL 16 (Prisma v6)")]
    Cache[("Redis 7 (Adapter, Locks, Limits)")]

    Web -->|HTTPS / WSS| Nginx
    Nginx -->|HTTP| API
    Nginx -->|WSS| API
    API --> DB
    API --> Cache
```

### Core Technologies
- **Runtime & Workspace:** Node.js 20+ / 24, pnpm workspaces (`pnpm@10.34.4`), TypeScript 5.9.
- **Frontend App:** React 18, Vite 7, Tailwind CSS v4, Radix UI, Axios, `i18next` (Arabic RTL primary, English secondary).
- **Backend API:** Express 5, TypeScript (compiled via esbuild/swc ESM), single unified bootstrap (`src/bootstrap.ts`).
- **Database & ORM:** PostgreSQL 16 with Prisma ORM v6 as the sole data-access layer.
- **State Coordination & Caching:** Redis 7 (`ioredis`), `@socket.io/redis-adapter` for multi-instance scaling, distributed Redlock locks.
- **Real-Time Engine:** Socket.IO 4.8.
- **Validation & Security:** `express-validator`, `@workspace/api-zod`, Helmet, rate-limit-redis, PBKDF2/bcryptjs password hashing.
- **Observability:** Winston structured JSON logging, correlation IDs (`X-Request-Id`), Sentry, Prometheus `/metrics`.

---

## 3. Repository Structure

```
├── artifacts/
│   ├── api-server/         # Express 5 backend, Prisma schema, tests
│   │   ├── prisma/         # schema.prisma & versioned migrations
│   │   ├── src/            # Controllers, routes, services, middleware
│   │   └── tests/          # Suite of 95+ unit and integration tests
│   └── university-app/     # React 18 + Vite frontend application
├── lib/                    # Shared workspace libraries
│   ├── api-client-react/   # Generated React Query API client
│   ├── api-spec/           # Generated OpenAPI specifications
│   └── api-zod/            # Shared Zod validation models
├── docs/                   # Dedicated documentation suite
│   ├── audits/             # Archived historical audits & compliance reports
│   ├── operations/         # Production runbooks (backup, disaster recovery, rollback)
│   ├── ARCHITECTURE.md     # In-depth system architecture
│   ├── AUTHORIZATION.md    # RBAC and tenant isolation model
│   ├── API.md              # API conventions, contracts, and error formats
│   ├── DATABASE.md         # Database conventions and migration guidelines
│   ├── ENVIRONMENT.md      # Comprehensive environment variable reference
│   ├── OPERATIONS.md       # Operational index, runbooks, and health probes
│   ├── SECURITY.md         # Security controls, auth flow, and threat mitigations
│   └── TROUBLESHOOTING.md  # Incident diagnosis and remediation runbook
├── scripts/                # Build, test, and operational automation utilities
├── compose.yaml            # Multi-container production Docker Compose stack
├── deploy.env.example      # Example production environment template
├── package.json            # Root workspace script definitions
└── pnpm-workspace.yaml     # Monorepo workspace configuration
```

---

## 4. Local Development Quick Start

### Prerequisites
- Node.js 20.x or higher
- pnpm (`npm install -g pnpm`)
- PostgreSQL 16 & Redis 7 (or running via Docker Compose)

### 1. Install Dependencies
```sh
pnpm install
```

### 2. Configure Environment
Set up your local environment variables in `artifacts/api-server/.env` (or pass via shell):
```env
PORT=8080
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/university?schema=public"
REDIS_URL="redis://127.0.0.1:6379"
JWT_SECRET="local-dev-jwt-secret-min-32-characters"
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
PUBLIC_ORIGIN="http://localhost:5173"
```

### 3. Initialize Database
```sh
# Generate Prisma Client
pnpm --filter @workspace/api-server run prisma:generate

# Apply database migrations
pnpm --filter @workspace/api-server run prisma:migrate
```

### 4. Start Development Servers
Run the API server and frontend application in separate terminals:

```sh
# Terminal 1: Backend API (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2: Frontend Web App (port 5173)
pnpm --filter @workspace/university-app run dev
```

---

## 5. Verification & Testing Commands

Execute the verified monorepo test and quality suites:

```sh
# Run all linters
pnpm run lint

# Monorepo typecheck across all packages
pnpm run typecheck

# Full production build
pnpm run build

# Run unit and security API tests
pnpm run test:api:unit

# Run full API test suite
pnpm run test:api

# Run frontend React component tests
pnpm run test:web

# Run web test harness execution coverage
# Note [TEST-001]: Measures node:test harness execution coverage across test files in artifacts/university-app/tests,
# asserting test assertion harness integrity rather than instrumented SPA application source code coverage.
pnpm run test:coverage

# Validate API schema contract drift against OpenAPI
pnpm run test:contract

# Validate Prisma schema
pnpm exec prisma validate --schema=artifacts/api-server/prisma/schema.prisma

# Security vulnerability audit
pnpm audit --audit-level high

# Full end-to-end verification gate
pnpm run verify
```

---

## 6. Documentation Index

For detailed architectural, security, and operational guides, consult the dedicated documentation:

```
README.md
  ├── docs/ARCHITECTURE.md      # Detailed topology, components, and design decisions
  ├── docs/ENVIRONMENT.md       # Complete environment variable reference
  ├── docs/AUTHORIZATION.md     # Multi-tenant isolation and role capability model
  ├── docs/API.md               # API contracts, pagination, and error standards
  ├── docs/DATABASE.md          # Prisma ORM, migrations, and precision standards
  ├── docs/OPERATIONS.md        # Operations master index, runbooks, and health probes
  ├── docs/SECURITY.md          # Cryptography, sessions, rate limits, and defenses
  ├── docs/TROUBLESHOOTING.md   # Incident diagnostics and failure remediation
  └── docs/audits/README.md     # Historical audit and compliance report archives
```
