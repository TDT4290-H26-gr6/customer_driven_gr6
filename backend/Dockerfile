FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npx prisma generate --schema=./prisma/schema

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss --schema=./prisma/schema; npm run dev"]