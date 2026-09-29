# CS-22B / H14 — 已知问题独立记录（不阻塞 CS-D，不阻塞 CS-E）

> 状态：**记录中（OPEN / independent）**。本文件只做记录，不修改任何代码、不降低或删除任何 H14 断言。
> 创建于 CS-D FINAL CLOSEOUT 阶段，按用户指令单独归档，避免被误判为 CS-D 回归。

## 问题摘要

- **H14**：供应商自评草稿刷新后 `supplier_assessments.responses_json = {}`（期望保留刷新前所填答案）。
- 触发位置：`scripts/cs22b_e2e.mjs`（CS-B 回归探针）第 22/1 项；CS-B 在线人工验收 `CS22B-ACCEPTANCE.md` 的 H14 当时记为 **PASS**（H10–H24 真实会话实跑），两者结论不一致的根因在**断言方式**而非业务逻辑。

## 已知事实（已确认）

1. 该问题在 **CS-D 代码责任域之外**：CS-D 只动了 Verification Badge / Expiry / History（公开档案页 + 目录页 + admin 注入 resolver），**未触碰**自评草稿 API（`/api/supplier-self-assessment`）。
2. CS-D 未修改任何自评 / 证据 / 草稿相关逻辑。
3. **CS-C 共享层回归 `_cs22c_live.mjs` = 71 / 0 通过**，证明 CS-D 上线未引入任何跨模块回归。
4. H14 在 `cs22b_e2e.mjs` 中确定性失败（≥2 次复跑均 FAIL），属**测试断言方法缺陷**，非生产功能缺陷：
   - 现有断言从**公开/服务端渲染 HTML** 中读取客户端 hydration 后才有的草稿数据 —— SSR HTML 里本就没有 `responses_json`，故读到 `{}`。
   - CS-B 在线人工验收（H10–H24）直接重查生产 DB `supplier_assessments.responses_json`，确认刷新前后答案一致（PASS），与探针结论矛盾，进一步坐实「探针断言方式错」而非「功能坏」。

## 处置原则（铁律）

- ❌ **不为了 H14 修改 CS-D**（CS-D 责任域外，动了反而引入回归风险）。
- ❌ **不降低、不删除现有 H14 断言**（避免假 PASS / 掩盖真实问题）。
- ❌ 不把 H14 计入 CS-D 回归失败项（它不是 CS-D 造成的）。
- ✅ H14 归 CS-B 单独排查 / 修复，与 CS-D FINAL PASS 解耦。

## 后续修复方向（待 CS-B 单独处理，除非 CS-E 明确依赖）

将 H14 的验证方式从「读取 SSR HTML」改为「读取草稿 API 返回值 / 数据库持久化结果」，并重新验证刷新前后 `responses_json` 一致性：

1. 断言数据源改为 `GET /api/supplier-self-assessment`（带真实会话）的返回体，或直连生产 DB `supplier_assessments.responses_json`（带真实会话凭据、非 anon）。
2. 流程：填 N 项 → `action=draft` 保存 → 模拟刷新（重新拉取草稿 API / 重查 DB）→ 断言返回 `responses_json` 含所填 N 项原值，且**不丢字段、不归零**。
3. 修复后重跑 `cs22b_e2e.mjs`，确认 H14 由 FAIL → PASS，且不引发其他项回归。
4. 若修复暴露真实功能缺陷（刷新确实清空答案），则升级为 P0 功能 bug，单独立项，与 CS-D 解耦处理。

## 与 CS-E 的关系

- CS-E（Share UI + 供应商看板统计）**不依赖** H14 自评草稿 API。
- CS-E 只读聚合统计（`supplier_share_events` / `supplier_visibility_scores` / `profile_views`）与分享 token，**不读写 `supplier_assessments.responses_json`**。
- 因此 H14 不影响 CS-E 执行；CS-E 发布链路无需等待 H14 修复。

## 当前结论

- H14 = **existing / independent failure**（CS-B 既有测试设计缺陷），非 CS-D 回归。
- CS-D FINAL PASS 不受影响（60/0 生产 E2E + CS-A/CS-C 回归全绿）。
- 本文件为唯一记录载体；后续修复在 CS-B 轨道单独进行。
