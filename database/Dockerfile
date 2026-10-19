# db-init: prepares the database, then exits. docker-compose.yml starts the
# backend only once this has finished successfully.
FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npx prisma generate

# 1. pre-push.sql prepares existing databases for schema changes db push
#    can't make on its own in MySQL (see the file); a no-op otherwise, and
#    best effort: a failure here doesn't stop the push.
# 2. Apply prisma/schema. A failure stops db-init, so the backend never runs
#    against a schema it doesn't match.
# 3. Load (or bring up to date) the SEED_DATASET content; see src/index.ts.
CMD ["sh", "-c", "npm run schema:prepare; npm run schema:push && npm run seed"]
