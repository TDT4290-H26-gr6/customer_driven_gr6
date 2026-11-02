# db-init: prepares the database, then exits. docker-compose.yml starts the
# backend only once this has finished successfully.
FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Runs as the image's unprivileged `node` user, not root.
WORKDIR /app
RUN chown node:node /app
USER node

# npm ci: installs exactly what package-lock.json pins.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .
RUN npx prisma generate

# Each step must succeed before the next, and any failure stops db-init (so
# the backend doesn't start):
# 1. pre-push.sql prepares existing databases for schema changes db push
#    can't make on its own in MySQL (see the file); a no-op otherwise.
# 2. Apply prisma/schema. Never with --accept-data-loss: a change that would
#    drop or narrow data stops here for a person to decide (see README,
#    "Schema changes that would lose data").
# 3. Load the WP2 curriculum into an empty database; see src/index.ts.
CMD ["sh", "-c", "npm run schema:prepare && npm run schema:push && npm run seed"]
