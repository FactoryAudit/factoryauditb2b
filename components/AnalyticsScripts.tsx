import Script from "next/script";

// AnalyticsScripts —— 全站分析脚本的唯一注入点（只在 root layout 挂一次）
//
// 设计要点：
// 1) 只在这里写 <Script>，页面/组件一律不重复引入，杜绝脚本重复加载；
// 2) strategy="afterInteractive"：等页面可交互后再加载，不阻塞 SSR、不阻塞首屏渲染，
//    正文 HTML 始终完整输出，Google / Bing / AI 爬虫读到的内容与无分析时完全一致；
// 3) 未配置环境变量时整个组件返回 null，页面不会多出任何空脚本标签；
// 4) 两个 ID（GA4 Measurement ID、Cloudflare beacon token）设计上就是公开标识符，
//    会出现在 HTML 源码里 —— 它们不是密钥，故用 NEXT_PUBLIC_ 前缀是安全的；
//    真正的密钥（如 DEEPSEEK_API_KEY、MAIL_HTTP_KEY）绝不放 NEXT_PUBLIC_。
// 5) 开发环境走 GA4 的 debug_mode，事件进 DebugView，不污染生产报表。

const GA4_ID = (process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? "").trim();
const CF_TOKEN = (process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN ?? "").trim();

/** 仅接受 G- 开头的 GA4 Measurement ID，避免误填把别的值当 ID 发出去 */
const GA4_ID_RE = /^G-[A-Z0-9]{6,15}$/i;
const isValidGa4 = GA4_ID_RE.test(GA4_ID);

/** Cloudflare beacon token 是 32 位十六进制串 */
const CF_TOKEN_RE = /^[a-f0-9]{32}$/i;
const isValidCf = CF_TOKEN_RE.test(CF_TOKEN);

const isDev = process.env.NODE_ENV !== "production";

export default function AnalyticsScripts() {
  if (!isValidGa4 && !isValidCf) return null;

  return (
    <>
      {/* ---------- Google Analytics 4 ---------- */}
      {isValidGa4 && (
        <>
          <Script
            id="ga4-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${GA4_ID}', { debug_mode: ${isDev ? "true" : "false"} });
`}
          </Script>
        </>
      )}

      {/* ---------- Cloudflare Web Analytics ----------
          自动采集 Visitors / Page Views / Top Pages / Referrers / Countries /
          Browsers / URL / Core Web Vitals，无需手动埋点，也不用 cookie。 */}
      {isValidCf && (
        <Script
          id="cf-beacon"
          src="https://static.cloudflareinsights.com/beacon.min.js"
          strategy="afterInteractive"
          data-cf-beacon={JSON.stringify({ token: CF_TOKEN })}
        />
      )}
    </>
  );
}
