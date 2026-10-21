import { PrismaClient } from "@prisma/client";

// This package's own Prisma client, generated from prisma/schema. The backend
// generates its own from the same schema (see backend/package.json).
export const prisma = new PrismaClient();
