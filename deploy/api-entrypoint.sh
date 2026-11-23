#!/bin/sh
# Start the Growlyze Property AI Agent API.
set -e
cd /app/backend

# The upstream Prisma migrations are out of sync with schema.prisma, so the
# schema is applied with `db push`. It refuses changes that would lose data.
npx prisma db push --skip-generate

# Same runtime as local development (ts-node, transpile-only).
exec node --require ts-node/register src/index.ts
