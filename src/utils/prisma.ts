import { PrismaClient } from '@prisma/client/edge';
import { PrismaD1 } from '@prisma/adapter-d1';

export function getPrisma(d1: D1Database) {
  const adapter = new PrismaD1(d1);
  return new PrismaClient({ adapter });
}
