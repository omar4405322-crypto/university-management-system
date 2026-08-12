# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Enable Corepack and prepare pnpm 9.15.9
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy root workspace configuration & lockfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# Copy required workspace libraries and api-server
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

# Install dependencies without frozen lockfile
RUN pnpm install --no-frozen-lockfile

# Generate Prisma Client & Build Production Bundle
RUN pnpm --filter @workspace/api-server run prisma:generate
RUN pnpm --filter @workspace/api-server run build

# Stage 2: Runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Enable Corepack and prepare pnpm 9.15.9 for running prisma/scripts
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy workspace build artifacts and dependencies from builder stage
COPY --from=builder /app /app

WORKDIR /app

EXPOSE 5000

# Execute database migrations then start production server
CMD ["sh", "-c", "pnpm --filter @workspace/api-server exec prisma migrate deploy && node --enable-source-maps ./artifacts/api-server/dist/index.mjs"]
