#!/usr/bin/env bash
# 全站路由冒烟：新增/改动页面 + 关键既有页面，逐个检查状态码。
# 用法：bash scripts/smoke-routes.sh [base_url]
BASE="${1:-http://localhost:3000}"

paths=(
  "/"
  "/tools"
  "/tools/supplier-risk-calculator"
  "/tools/supplier-verification-checklist"
  "/suppliers"
  "/services"
  "/services/supplier-verification"
  "/services/supplier-improvement"
  "/services/china-supplier-verification"
  "/services/china-factory-audit"
  "/services/vietnam-supplier-verification"
  "/services/vietnam-factory-audit"
  "/services/thailand-supplier-verification"
  "/services/thailand-factory-audit"
  "/countries"
  "/countries/china"
  "/countries/vietnam"
  "/countries/thailand"
  "/resources"
  "/guides"
  "/guides/how-to-verify-a-chinese-supplier"
  "/guides/factory-audit-checklist"
  "/guides/supplier-risk-assessment-guide"
  "/methodology"
  "/pricing"
  "/rfq"
  "/factory-audit/request"
  "/custom-services"
  "/logistics"
  "/about"
  "/zh"
  "/zh/tools"
  "/zh/countries/china"
  "/zh/services/vietnam-factory-audit"
)

fail=0
for p in "${paths[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 20 "$BASE$p")
  if [ "$code" = "200" ]; then
    printf "  ok   %-6s %s\n" "$code" "$p"
  else
    printf "  FAIL %-6s %s\n" "$code" "$p"
    fail=$((fail+1))
  fi
done

echo "--- redirects (expect 200 after following, target path should differ) ---"
for p in "/knowledge" "/inspectors" "/country/china"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 20 "$BASE$p")
  target=$(curl -s -o /dev/null -w "%{url_effective}" -L --max-time 20 "$BASE$p")
  printf "  %-6s %-16s -> %s\n" "$code" "$p" "$target"
done

echo "--- sitemap / llms ---"
for p in "/sitemap.xml" "/llms.txt" "/robots.txt"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$BASE$p")
  printf "  %-6s %s\n" "$code" "$p"
done

echo ""
if [ "$fail" -eq 0 ]; then
  echo "ALL ROUTES 200"
else
  echo "$fail FAILED ROUTES"
fi
exit $fail
