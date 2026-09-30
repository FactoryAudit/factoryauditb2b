// deploy/ecosystem.config.js —— PM2 进程配置（宝塔「Node 项目」底层也用 PM2）
//
// 用法（服务器上，项目根目录）：
//   pm2 start deploy/ecosystem.config.js
//   pm2 save            # 保存进程列表，重启服务器后自动拉起
//   pm2 logs factoryauditb2b
//
// 为什么用 cluster 之外的单实例（instances: 1）：
//   本应用用 Next 的 ISR/预渲染产物 + 模块级缓存（限流 Map、PayPal token 缓存）。
//   多实例不会出错，但会让限流与 token 缓存各自为政 —— 在单机小内存场景下，
//   单实例更省内存、行为更可预测。需要横向扩展时再改 instances。
module.exports = {
  apps: [
    {
      name: "factoryauditb2b",
      // standalone 产物自带的服务器入口（由 next build 生成）
      script: "server.js",
      cwd: __dirname ? require("path").resolve(__dirname, "..") : ".",

      instances: 1,
      exec_mode: "fork",

      // .env.production 由 server.js 自行读取，PM2 不需要注入变量；
      // 如你的部署把 env 放在别处，用下面的 env_file 指过去。
      // env_file: "/opt/factoryauditb2b/.env.production",

      // 内存上限：超过则重启（单机兜底，防止长期运行累积后拖垮整机）。
      // 自托管机器的可用内存应在 1GB 以上，故设 900M 作为重启阈值。
      max_memory_restart: "900M",

      // 崩溃自愈。连续快速失败时 PM2 会退避，不会打成死循环。
      autorestart: true,
      max_restarts: 10,
      min_uptime: "30s",
      restart_delay: 4000,

      // 日志（宝塔「文件」里可直接看）
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-err.log",
      merge_logs: true,
      time: true,
    },
  ],
};
