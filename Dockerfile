# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Enable Corepack and prepare pnpm 9.15.9
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy dependency manifests first so installs remain cacheable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/

# Install dependencies without frozen lockfile
RUN pnpm install --no-frozen-lockfile --strict-peer-dependencies=false

# Copy only the source and configuration required to build the API
COPY tsconfig.base.json ./
COPY artifacts/api-server/build.mjs artifacts/api-server/tsconfig.json ./artifacts/api-server/
COPY artifacts/api-server/src/ ./artifacts/api-server/src/
COPY artifacts/api-server/prisma/schema.prisma ./artifacts/api-server/prisma/
COPY artifacts/api-server/prisma/migrations/ ./artifacts/api-server/prisma/migrations/
COPY lib/api-zod/src/ ./lib/api-zod/src/
COPY lib/db/src/ ./lib/db/src/

# Generate Prisma Client & Build Production Bundle
RUN pnpm --filter @workspace/api-server run prisma:generate
RUN pnpm --filter @workspace/api-server run build

# Stage 2: Runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Enable Corepack and prepare pnpm 9.15.9 for running prisma/scripts
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy only runtime manifests, dependencies, the compiled server, and active migrations
COPY package.json pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/artifacts/api-server/node_modules/ ./artifacts/api-server/node_modules/
COPY --from=builder /app/artifacts/api-server/dist/ ./artifacts/api-server/dist/
COPY --from=builder /app/artifacts/api-server/prisma/schema.prisma ./artifacts/api-server/prisma/
COPY --from=builder /app/artifacts/api-server/prisma/migrations/ ./artifacts/api-server/prisma/migrations/

WORKDIR /app

EXPOSE 5000

# Execute database migrations then start production server
CMD ["sh", "-c", "pnpm --filter @workspace/api-server exec prisma migrate resolve --applied 0000_baseline_existing_database && pnpm --filter @workspace/api-server exec prisma migrate deploy && node --enable-source-maps ./artifacts/api-server/dist/index.mjs"]
