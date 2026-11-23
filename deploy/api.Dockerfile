# Growlyze Property AI Agent — backend API image.
# Build context: repository root (npm workspaces; the lockfile lives there).
FROM node:20-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# npm ci validates the lockfile against every workspace manifest, so copy them
# all, but install only the backend workspace (plus root dependencies).
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY dashboard/package.json dashboard/package.json
COPY propertyapp/package.json propertyapp/package.json
COPY ContractorApp/package.json ContractorApp/package.json
RUN npm ci --workspace=backend --include-workspace-root --no-audit --no-fund \
 && npm cache clean --force

COPY backend backend
COPY deploy/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh

WORKDIR /app/backend
RUN npx prisma generate && mkdir -p voicemails uploads

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD curl -fsS http://localhost:3001/api/health || exit 1

CMD ["sh", "/usr/local/bin/api-entrypoint.sh"]
