import { PrismaClient } from '@prisma/client';
import { NODE_ENV } from '../config.js';

const globalForPrisma = global;

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
