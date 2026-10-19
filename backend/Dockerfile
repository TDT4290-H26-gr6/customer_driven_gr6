# The API only: the database is prepared beforehand by db-init (database/).
#
# Built from the repository root (see docker-compose.yml) because the Prisma
# schema lives in database/prisma/schema: the backend generates its own
# client from a copy of it (the same copy `npm run prisma:generate` makes).
FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm install

COPY backend/ ./
COPY database/prisma/schema ./prisma/schema
RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "run", "dev"]
