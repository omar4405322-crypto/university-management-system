# Debugging Session: Backend 502 Bad Gateway

- **ID**: backend-502-bad-gateway
- **Status**: [OPEN]
- **Created**: 2026-06-07
- **Symptoms**: Frontend reporting 502 Bad Gateway for `/api/notifications` and `/api/dashboard/stats`.

## 1. Hypotheses
- **H1: Backend Server Crash**: The backend server is failing to start because of a TypeScript error or runtime exception in `server.ts`/`app.ts`.
- **H2: Port Mismatch**: The backend is on port 5002, but the frontend proxy expects another port (e.g., 5000/5001).
- **H3: `ts-node` Execution Failure**: The `dev` script in `package.json` is failing to launch correctly via `nodemon`.
- **H4: Path Resolution Error**: Runtime failure in importing `app` or routes due to `.js` vs `.ts` confusion.

## 2. Evidence Timeline
| Timestamp | Event | Data/Log | Hypothesis Linked |
|-----------|-------|----------|-------------------|
| | | | |

## 3. Instrumentation Plan
- [ ] Start Debug Server.
- [ ] Instrument `server.ts` to report startup and listening events.
- [ ] Check frontend environment for API URL/Port configuration.

## 4. Analysis & Results
(Pending logs)

## 5. Resolution Path
(Pending fix)
