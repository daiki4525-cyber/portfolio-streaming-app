import { PrismaClient } from "@prisma/client";

/**
 * Prismaクライアントの共有インスタンス。
 *
 * PrismaClientはDB接続プールを保持するため、リクエストごとにnewすると
 * 接続数が枯渇する。アプリ全体で必ずこのインスタンスを使い回す。
 *
 * 開発時(tsx watch等)はホットリロードのたびにモジュールが再評価され
 * インスタンスが増え続けるため、globalThisにキャッシュして防ぐ。
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
