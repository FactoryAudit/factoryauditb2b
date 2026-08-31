/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" }
        ]
      }
    ];
  },
  // Cloudflare Workers 部署（OpenNext）：这些包有 workerd 特定入口，
  // 必须外部化，让运行时加载 workerd 版本而非 Node 版本。
  // @prisma/client：Prisma runtime 的 workerd 条件导出
  // pg：pg 驱动的 workerd 入口（预留，当前用 PrismaNeon 则不需要，但保留无害）
  serverExternalPackages: ["@prisma/client", ".prisma/client", "pg", "postgres"]
};
export default nextConfig;
