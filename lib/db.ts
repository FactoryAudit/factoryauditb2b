import { Prisma, PrismaClient } from "@/generated/prisma-client";
import { PrismaNeon } from "@prisma/adapter-neon";

// 数据库双模式：
//   - 本地开发：SQLite（DATABASE_URL="file:./dev.db"）→ 默认 PrismaClient，零依赖
//   - 生产（Cloudflare Workers）：PostgreSQL（DATABASE_URL="postgresql://..."）→
//     PrismaNeon driver adapter（@neondatabase/serverless 驱动）
//     * Workers 无法加载 Prisma 原生二进制引擎，必须用纯 JS/WASM 的 driver adapter
//     * Neon serverless driver 走 WebSocket，是 Neon 官方为 Workers 场景推荐的路径
//     * 单例 + serverless 池语义：连接用完即释放，不跨请求复用（Workers 禁止）
const url = process.env.DATABASE_URL ?? "";
const isPostgres = url.startsWith("postgres");

// Next.js 开发模式下避免热重载产生多个 PrismaClient 实例（仅 SQLite 本地模式适用）
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// 类型断言说明：生成的 client 类型里 Prisma.PrismaClientOptions interface 不含 adapter 字段
// （driver adapter 的类型在 runtime/library.d.ts 中才完整，Prisma 6.5 生成器的已知缺口），
// 但运行时 PrismaClient 完全支持 adapter。用 unknown 中转断言，双环境（本地/CI）均安全。
const adapterOptions = (connectionString: string) =>
  ({ adapter: new PrismaNeon({ connectionString }) } as unknown as Prisma.PrismaClientOptions);

export const prisma: PrismaClient = isPostgres
  ? new PrismaClient(adapterOptions(url))
  : globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production" && !isPostgres) globalForPrisma.prisma = prisma;
