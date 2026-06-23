# University Management System — 6th of October University of Technology

A full-stack university management portal for جامعة 6 أكتوبر التكنولوجية. Supports students, doctors (faculty), admins, teaching assistants and staff. UI is fully in Arabic (RTL) with lime-green + navy branding.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port from `$PORT`, defaults to 8080)
- `pnpm --filter @workspace/university-app run dev` — run the frontend (Vite, port from `$PORT`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite 7, Tailwind CSS v4, react-router-dom v6, i18next (Arabic/English), react-hot-toast
- API: Express 5, tsx (dev runner)
- DB: PostgreSQL + Prisma ORM v6
- Auth: JWT (access + refresh tokens), bcryptjs
- Real-time: Socket.IO
- File uploads: Multer (local disk) / Cloudinary (if configured)

## Where things live

- `artifacts/university-app/src/` — React frontend (pages, components, context, hooks, services, utils, i18n)
- `artifacts/api-server/src/` — Express backend (routes, controllers, middleware, utils)
- `artifacts/api-server/prisma/schema.prisma` — Prisma DB schema (source of truth)
- `artifacts/university-app/src/index.css` — Brand CSS (Tailwind v4 + custom lime-green/navy color system)

## Architecture decisions

- Backend runs as ESM (`"type": "module"`) via tsx — use `import.meta.url` + `fileURLToPath` instead of `__dirname`
- Prisma v6 (not v7) — v7 dropped `directUrl` support; schema uses `url = env("DATABASE_URL")` only
- DB sequence `doctor_id_seq` must exist before schema push — created manually via `CREATE SEQUENCE IF NOT EXISTS doctor_id_seq`
- API served at `/api` prefix, frontend at `/` in Replit's path-based routing
- JWT_SECRET auto-generated in dev if not set in env

## Product

- Login / registration with role-based access (Admin, Doctor, Student, Teaching Assistant, Staff)
- Student portal: courses, grades, attendance, payments, exams, quizzes
- Doctor portal: course management, grade entry, attendance tracking
- Admin portal: user management, department/college management, analytics
- Fully Arabic RTL interface with i18n support

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The `doctor_id_seq` PostgreSQL sequence must exist before `prisma db push` — run `CREATE SEQUENCE IF NOT EXISTS doctor_id_seq;` first
- All ESM files using filesystem paths need `__dirname` polyfilled: `import { fileURLToPath } from 'url'; const __dirname = path.dirname(fileURLToPath(import.meta.url));`
- `export =` syntax is not valid ESM — use `export default`
- Frontend auto-attempts token refresh on load; 401 errors on startup are expected (no session yet)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
