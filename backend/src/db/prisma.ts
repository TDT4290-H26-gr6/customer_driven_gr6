import { PrismaClient } from "@prisma/client";

// Single shared Prisma client for the whole app. Modules import from here;
// nothing else instantiates PrismaClient.
export const prisma = new PrismaClient();
