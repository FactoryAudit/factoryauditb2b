# /suppliers 页面供应商进驻 CTA — 交付说明

日期：2026-08-29
服务：http://localhost:3000

---

## 交付内容

按截图中 `/zh/suppliers` 页面下方的空白区域，加入了供应商进驻号召广告。

| 项 | 文件 | 说明 |
|---|---|---|
| 页面重构 | `app/[locale]/suppliers/page.tsx` | 接入字典，补 metadata + openGraph + hreflang |
| CTA 横幅 | 同上 | 供应商网格下方新增蓝渐变卡片 |
| 多语言文案 | `i18n/dictionaries/{en,zh,es,de,fr,pt}.json` | 新增完整 `suppliers` 键 |

---

## CTA 内容

| 元素 | 中文（截图语言）| 英文 |
|---|---|---|
| 标题 | 您是供应商？ | Are you a supplier? |
| 说明 | 加入名录，发布工厂档案，通过平台审核，让从中国及亚洲采购的买家找到您。 | Join the directory, publish your factory profile, pass our verification and get discovered by buyers sourcing from China and Asia. |
| 四步流程 | 注册 → 发布信息 → 平台审核 → 上架展示 | Register → Publish profile → Platform audit → Go live |
| 按钮 | 申请进驻 | Join as a supplier |
| 按钮去向 | `/custom-services` | 同上 |

---

## 验证结果

| 检查项 | 结果 |
|---|---|
| `next build` | ✅ EXIT=0 |
| `/suppliers` 6 语言 | ✅ 全 200 |
| 中文页 CTA 标题 | ✅ 出现"您是供应商？" |
| 四步流程 | ✅ 注册 / 发布信息 / 平台审核 / 上架展示 均出现 |
| 按钮 | ✅ "申请进驻" 出现，链到 `/custom-services` |

---

## 用户路径

1. 供应商浏览 `/suppliers` 目录
2. 看到页面底部 CTA："您是供应商？"
3. 了解 4 步进驻流程
4. 点击"申请进驻" → 进入 `/custom-services` 表单
5. 填写公司、邮箱、所在地、主营产品等信息提交
6. 后台 `/admin/leads` 收到线索，状态为 `NEW`

---

## 后续可选增强

1. 创建专属 `/supplier-join` 页面，字段更贴合供应商入驻（主营产品、工厂地址、产能、出口市场、证书等）
2. 供应商提交后自动发送确认邮件
3. 审核通过后在 `Supplier` 表新增记录并上架展示
