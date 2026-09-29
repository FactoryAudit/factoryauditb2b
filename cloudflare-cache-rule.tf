# Cloudflare Cache Rule — /industrial-clusters/* Edge TTL 2h
# 作用：把集群详情/聚合页在 CF 边缘缓存 2 小时，Googlebot 命中边缘、不打香港主机，
#       直接消除爬取期 503 并省下 crawl budget。不动应用代码、不冻数据（TTL 到期自动回源）。
#
# 🔴 三个已被实测证伪/修正的关键点（改动前必读）：
#   1) phase 必须是 "http_request_cache_settings"（旧写法 "http_cache" 无效）。
#   2) 源站返回 "Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate"，
#      实测上线前 CF 连 cf-cache-status 头都不返回 → no-store 阻止缓存。
#      故 edge_ttl.mode 必须用 "override_origin"（= 仪表盘 "Ignore origin cache control"），
#      否则规则上线也不会 HIT。
#   3) 登录 cookie 是 Supabase SSR 的 sb-tcyhstswppoqwlmchsmc-auth-token（含 .0/.1 分片），
#      用 contains "sb-" 前缀匹配；旧写法 fab_session 在本项目不存在。
#
# 应用方式（任选其一）：
#   A. 仪表盘【推荐】：规则 > 缓存规则 > 新建（见文件底部 EXPRESSION / TTL 说明）
#   B. Terraform：terraform init && terraform apply（token 需 Cache Rules:Edit）
#   C. node _cf_cache_rule.mjs（token 需 Zone Rulesets / Cache Rules 权限）

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 4.0"
    }
  }
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Zone ID of factoryauditb2b.com"
}

# token 走环境变量 CLOUDFLARE_API_TOKEN（需 Cache Rules:Edit）

resource "cloudflare_ruleset" "cluster_edge_cache" {
  zone_id = var.cloudflare_zone_id
  name    = "cluster-edge-cache"
  kind    = "zone"
  phase   = "http_request_cache_settings" # 🔴 不是 "http_cache"

  rules {
    description = "Cache /industrial-clusters/* 2h @ edge (ignore origin no-store); bypass on Supabase auth cookie; never cache admin/rfq/account/api"
    expression  = <<-EOT
      (lower(http.request.uri.path) matches ".*/industrial-clusters/.*"
       and not starts_with(lower(http.request.uri.path), "/admin")
       and not starts_with(lower(http.request.uri.path), "/rfq")
       and not starts_with(lower(http.request.uri.path), "/account")
       and not starts_with(lower(http.request.uri.path), "/api"))
      and not any(http.request.cookies[*].name contains "sb-")
    EOT
    action      = "set_cache_settings"

    cache_settings {
      cache = true

      # 🔴 必须 override_origin：源站 no-store，否则 CF 不缓存（实测无 cf-cache-status）
      edge_ttl {
        mode    = "override_origin"
        default = 7200
      }

      browser_ttl {
        mode    = "respect_origin"
        default = 0
      }

      # 5xx 不显式设置：CF 默认不缓存 5xx，避免瞬断 503 被缓存后误伤全站
      cache_ttl_by_status {
        codes = "200"
        ttl   = 7200
      }

      cache_ttl_by_status {
        codes = "404"
        ttl   = 60
      }
    }
  }
}

# ---------------------------------------------------------------------------
# 仪表盘手动上线参数（推荐路径，无需 token 权限）
# ---------------------------------------------------------------------------
# 位置：Cloudflare 控制台 → factoryauditb2b.com → 规则(Rules) → 缓存规则(Cache Rules) → 新建规则
#
# 规则名称：cluster-edge-cache
#
# 匹配表达式（Custom filter expression，整段粘贴，须为可折叠单行）：
#   (lower(http.request.uri.path) matches ".*/industrial-clusters/.*" and not starts_with(lower(http.request.uri.path), "/admin") and not starts_with(lower(http.request.uri.path), "/rfq") and not starts_with(lower(http.request.uri.path), "/account") and not starts_with(lower(http.request.uri.path), "/api")) and not any(http.request.cookies[*].name contains "sb-")
#
# 缓存设置：
#   - Cache eligibility（缓存资格）: Eligible for cache = ON
#   - Edge TTL: 选 "Ignore origin cache control"（忽略源站缓存头），值 = 2 小时 (7200s)
#       🔴 这一步最关键：只填 TTL 不勾此项，源站 no-store 会让规则完全不生效
#   - Browser TTL: Respect origin (0)
#   - 不要勾选 "Cache by status" 里的 5xx
#
# 保存后验证：
#   curl -D - https://factoryauditb2b.com/industrial-clusters/china/guangdong/dongguan-electronics
#   连续第 2 次起应见：CF-Cache-Status: HIT
# ---------------------------------------------------------------------------
