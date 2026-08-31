import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext Cloudflare 官方推荐配置入口。
// 空配置即使用完整的 Cloudflare 默认值（cloudflare-node wrapper / edge converter / fetch proxy / dummy cache）。
// 暂不启用 R2 incremental cache（避免部署时要求创建 R2 bucket），后续需要缓存再配置。
export default defineCloudflareConfig({});
