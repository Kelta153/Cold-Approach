import { PrismaClient } from '@prisma/client';

// Single shared Prisma client — apps/api imports this, never generates its own.
export const prisma = new PrismaClient();

export * from '@prisma/client';
