---
trigger: always_on
description: UniCore environment, search, version, safety and evidence rules that apply to every task in this repository.
---

# UniCore working rules

Graphify usage is covered by `graphify.md` and `graphify-usage.md`; those take precedence for graph questions.

## Environment
- Windows with PowerShell 5.1 syntax: no `&&`, no Unix-only flags. Package manager: pnpm (monorepo). Search tool: ripgrep (`rg`).
- Apps: `artifacts/api-server` (Express, Prisma 6.19.3, PostgreSQL) and `artifacts/university-app` (React 19, TypeScript, Tailwind CSS v4). `lib/api-zod` and `lib/api-client-react` are generated: keep them in sync. `3d/` is an experiment, not part of the app.
- All API routes are under `/api/...`. There is no `/api/v1`.
- The project is on Prisma 6.19.3. Follow the existing PrismaClient setup in the code; do not copy Prisma 7 documentation patterns.
- Tailwind v4 is CSS-first. Do not introduce Tailwind v3 patterns such as a `tailwind.config.js` setup.

## Searching
- Use `rg -n` with explicit paths or globs under `src/` and `tests/`. Never run recursive `Get-ChildItem` or `Select-String` over `node_modules`, `artifacts/` or the repo root.
- Before you use or report any function, class, route, file path, line number or Prisma field, confirm it with `rg -n` or by reading the defining file in this session. Never guess names.
- A keyword match count is not proof. Report real call sites.

## Safety
- Ask for explicit approval before: `git push`, `git reset --hard`, `git clean`, `prisma migrate reset`, `prisma db push --force-reset`, SQL `DROP`, `TRUNCATE` or a `DELETE` without a precise `WHERE`, `redis-cli flushall` or `flushdb`, `Remove-Item -Recurse`, and any `vercel` or `railway` command that changes state.
- Never print `.env` contents, tokens or passwords. Do not commit unless asked.
- Stay inside the task scope and list every file you changed.

## Evidence and reporting
- Do not write "verified", "all tests pass" or "no issues" unless you ran the command in this turn and show its output.
- When quoting code, print the raw lines, not a summary.
- End every report with a specific "Could not verify" section: each item, what you tried, why it failed. No generic statements.
- If a needed command is blocked, say so; do not work around it.