# Production deployment

## Requirements

- Docker Engine with Docker Compose
- A domain with HTTPS terminated by a trusted reverse proxy or hosting platform

## Start the stack

1. Copy `deploy.env.example` to `deploy.env`.
2. Set `PUBLIC_ORIGIN` to the public HTTPS origin.
3. Replace the database password and generate independent values for `JWT_SECRET` and `ENCRYPTION_KEY`.
4. Start the application:

   ```sh
   docker compose --env-file deploy.env up -d --build
   ```

5. Confirm that all services are healthy:

   ```sh
   docker compose --env-file deploy.env ps
   ```

The site listens on `APP_PORT` (8080 by default). Database migrations run automatically before the API starts. PostgreSQL, Redis, uploaded files, and application data use persistent Docker volumes.

## Before every release

```sh
pnpm install --frozen-lockfile --strict-peer-dependencies=false
pnpm run verify
```

Do not commit `deploy.env` or expose PostgreSQL, Redis, or the API container directly to the internet.
