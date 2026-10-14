FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npx prisma generate --schema=./prisma/schema

EXPOSE 4000

# pre-push.sql prepares existing databases for schema changes db push can't
# make on its own in MySQL (see the file); a no-op otherwise.
CMD ["sh", "-c", "npx prisma db execute --schema=./prisma/schema --file ./prisma/pre-push.sql; npx prisma db push --accept-data-loss --schema=./prisma/schema; npm run dev"]