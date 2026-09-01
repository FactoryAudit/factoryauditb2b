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
  // Cloudflare Workers 部署（OpenNext）
  // 已去除数据库（V2.0 轻量化）：不再需要外部化 Prisma / pg / postgres。
  serverExternalPackages: []
};
export default nextConfig;
