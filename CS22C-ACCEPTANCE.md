# CS-C PRODUCTION ACCEPTANCE REPORT

> 真实链路：Supabase Auth → Session Cookie → 生产 API (https://factoryauditb2b.com) → 生产 Database
> 生成时间：2026-09-24T06:08:47.881Z

## 汇总
- **结果**：ALL PASS ✅
- **PASS / FAIL**：71 / 0

## Test Account（不输出密码）
- Supplier Auth: cs22c-sup-sndy4y@example.com
- Admin Auth: cs22c-adm-sndy4y@example.com
- Buyer Auth: cs22c-buy-sndy4y@example.com
- Supplier ID: f5066115-071a-47e8-891f-2107455e2afc
- Supplier slug: cs-c-test-do-not-publish
- 专用名：CS-C-TEST-DO-NOT-PUBLISH（is_published=false / public_profile_enabled=false / profile_status=draft / verification_level=unverified）

## Admin Flow
- #1 Admin 登录 ✅
- #2 待审核队列含本 Supplier ✅
- #3 72 项 Assessment 模板渲染 ✅
- #4 responses_json 读取 ✅
- #5 Evidence 查看 + 签名短链 ✅
- #6/#7/#8/#9 单项 Approve / Reject / Need More Info / Reviewer Note ✅
- #10 Review Progress（decided/total） ✅
- #11 Action Required ✅
- #12 Supplier 真实 Resubmit（CS-B 端点） ✅
- #13 Admin 再次 Review ✅

## Online Verification
- #14 Admin 显式 Approve Online ✅
- #15 verification_records 创建 / verification_id=FAB2B-OV-B4KVXX / status=ACTIVE / type=ONLINE / verified_at+expires_at(+365d) / 前台 ONLINE VERIFIED / 供应商自创被 RLS 拒 ✅

## On-site Verification
- #16 独立 ON_SITE verification（id=FAB2B-OS-WABEDR） ✅
- #17 visit_date / verifier / location / scope / notes / verification_id 全部落库 ✅
- #18 Admin Approve ✅
- #19 前台 ON-SITE VERIFIED ✅
- #20 Online 与 On-site 记录互不覆盖（各自独立行，ON_SITE 优先生效） ✅

## Security
- #21 Supplier A 不能操作 Supplier B（API 401 + RLS 拒） ✅
- #22 Supplier 不能创建/改 verification_records（INSERT/UPDATE 全被 RLS 拒） ✅
- #23 Buyer/匿名不能改 Admin Review 数据（RLS 拒 + Admin 端点 401） ✅
- #24 Admin 正常审核 ✅

## RLS
- verification_records：anon 无权限；authenticated 仅 SELECT；写入仅 service_role（Admin 经 requireAdmin）
- supplier_assessments：Supplier 仅经 resolveSupplierAccess 改自身；item_review_json 由 Admin 写

## Audit Log
- 谁审核：actor_email = cs22c-adm-sndy4y@example.com
- 审核什么：action ∈ {ASSESSMENT_REVIEW_SAVED, ASSESSMENT_NEEDS_MORE_INFO, ONLINE_VERIFICATION_APPROVED, ON_SITE_VERIFICATION_APPROVED, ...}
- 什么时候：created_at 非空
- 什么结果：metadata.verification_id 等
- 全部写入现有 admin_audit_log ✅

## Verification History
- Online → EXPIRED（保留旧行）→ Re-verification（新 ACTIVE 行）；旧 EXPIRED 行不删除，历史完整保留 ✅

## Database Before / After（测试 Supplier 作用域）
```json
{
  "before": {
    "suppliers": 1,
    "assessments": 0,
    "records": 0,
    "items": 0,
    "evidence": 1,
    "audit": 0,
    "share": 0,
    "images": 0
  },
  "after": {
    "suppliers": 1,
    "assessments": 1,
    "records": 3,
    "items": 144,
    "evidence": 1,
    "audit": 5,
    "share": 0,
    "images": 0
  }
}
```

## Cleanup Result
- Auth 用户（4）、Supplier（2）、Assessment、Evidence（+Storage 对象）、Images、Share events、Audit log、Verification records/items 全部删除 ✅
- 未触碰任何真实供应商 / RFQ / CS-A·CS-B 生产数据 ✅

## Git Commit / Deploy Version / Live Verify
- Git Commit / Deploy Version：见交付说明（本脚本只跑验收，提交由交付流程完成）
- Live Verify Result：ALL PASS

## 逐项明细
- [PASS] 建 4 个临时 Auth 用户 (supplier/admin/buyer/supplierB)
- [PASS] admin profiles.role=admin
- [PASS] 建专用非公开 Supplier (legal_name=CS-C-TEST-DO-NOT-PUBLISH)  :: f5066115-071a-47e8-891f-2107455e2afc
- [PASS] 建 Supplier B（跨账户隔离测试用）
- [PASS] 建 supplier_evidence 测试行 + Storage 对象
- [PASS] 登录取得 supplier / admin / buyer 会话 cookie
- [PASS] supplier 经 anon 客户端登录(取 JWT)
- [PASS] buyer 经 anon 客户端登录(取 JWT)
- [PASS] #1 Admin 登录成功 (HTTP 200 + cookie)
- [PASS] #2 供应商真实提交自评 (CS-B 端点)  :: status=submitted
- [PASS] #2 Admin 查看待审核队列含本 Supplier  :: queueLen=1
- [PASS] #3 Admin 查看工作台 200  :: status=200
- [PASS] #3b 模板含 72 项自评题  :: totalQ=72
- [PASS] #4 读取 responses_json（含提交答案）  :: respKeys=72
- [PASS] #3c 自评状态=submitted  :: =submitted
- [PASS] #3d 信任状态=SELF_ASSESSED（未核验）  :: =SELF_ASSESSED
- [PASS] #5 Admin 查看 Evidence（按 item 分组）  :: count=1
- [PASS] #5b Admin 证据签名短链返回 url  :: status=200 mime=application/pdf body={"ok":true,"url":"https://tcyhstswppoqwlmchsmc.supabase.co/storage/v1/object/sign/supplier-docs/cs22c/f5066115-071a-47e8-891f-2107455e2afc/ev1.pdf?token=eyJraWQiOiI2YzA4MDMzOS02ZjYzLTRjNTktODliMy1iZjgyMzZiMTQ4MWQiLCJhbGciOiJIUzUxMiJ9.eyJ1cmwiOiJzdXBwbGllci1kb2NzL2NzMjJjL2Y1MDY2MTE1LTA3MWEtNDdlOC04OTFmLTIxMDc0NTVlMmFmYy9ldjEucGRmIiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc5MDIzMDAzNywiZXhwIjoxNzkwMjMwMzM3fQ.E-9sJ5uPG84LUfrxPayOHBH5cv-aeLamrpXwToIOpkf2yNr2g4pPLaj6kv2oGwX3USNEuiySQrJgc61dz_Gfqw","mime":"application/pdf"}
- [PASS] #6/#7/#8/#9 Admin 逐项审核保存 (Approve/Reject/NeedMoreInfo/Note)  :: status=200
- [PASS] #6 单项 Approve 已记录
- [PASS] #7 单项 Reject 已记录
- [PASS] #8 NEED_MORE_INFO 已记录
- [PASS] #9 Reviewer Note 已记录
- [PASS] #10 Review Progress = decided/total  :: decided=72/72
- [PASS] #11 Admin 标记 Action Required
- [PASS] #11b 自评状态=action_required  :: =action_required
- [PASS] #12 Supplier 真实回补/Resubmit (CS-B 端点)  :: status=resubmitted
- [PASS] #13 Admin 再次 Review（状态已更新）  :: =resubmitted
- [PASS] #14 Admin 显式点击 Approve Online Verification  :: status=200
- [PASS] #14b verification_id = FAB2B-OV-*  :: =FAB2B-OV-B4KVXX
- [PASS] #15 verification_records 已创建 (ONLINE)
- [PASS] #15b status=ACTIVE  :: =ACTIVE
- [PASS] #15c verification_type=ONLINE
- [PASS] #15d verification_id 一致
- [PASS] #15e verified_at / expires_at 非空
- [PASS] #15f expires_at = verified_at + 365d (±2s)  :: diffDays=365
- [PASS] #15g verification_items 含逐项结论 (72)  :: count=72
- [PASS] #15h 公开页 200 + 显示 Online verified 徽章  :: status=200
- [PASS] #15i 供应商经 anon 客户端 INSERT verification_records 被 RLS 拒绝  :: err=42501
- [PASS] #16 Admin 创建独立 ON_SITE verification  :: status=200
- [PASS] #16b verification_id = FAB2B-OS-*  :: =FAB2B-OS-WABEDR
- [PASS] #17 ON_SITE 记录存在
- [PASS] #17b verification_id 一致
- [PASS] #17c visit_date 已存  :: =2026-09-24
- [PASS] #17d verifier 已存  :: =CS22C Auditor
- [PASS] #17e location 已存  :: =Guangzhou, CN
- [PASS] #17f notes 已存
- [PASS] #17g scope(jsonb) 已存=被标记项  :: scope=["QC01","QC02"]
- [PASS] #18 Admin Approve On-site 成功 (HTTP 200)
- [PASS] #19 公开页显示 On-site verified 徽章  :: status=200
- [PASS] #20 两条独立记录均在 (互不复盖)
- [PASS] #20b 当前生效状态=ON_SITE_VERIFIED（ON_SITE 优先）  :: =ON_SITE_VERIFIED
- [PASS] #21 Supplier A 用自身 cookie 访问 Supplier B 后台 → 401  :: status=401
- [PASS] #21b 非 admin 经 RLS 改 Supplier B 行被拒（数据未被篡改）  :: err=undefined legal_name=CS22C Supplier B sndy4y
- [PASS] #22 Supplier 改 verified_at/expires_at/type/status 被 RLS 拒绝  :: err=42501
- [PASS] #22b Supplier 创建 verification_records 被 RLS 拒绝  :: err=42501
- [PASS] #23 Buyer 改 item_review_json 被 RLS 拒绝  :: err=42501
- [PASS] #23b 匿名(无会话) 插入 verification_records 被拒  :: err=42501
- [PASS] #23c Buyer cookie 调 Admin 端点 → 401  :: status=401
- [PASS] #23d 无 cookie 调 Admin 端点 → 401  :: status=401
- [PASS] #24 Admin 审核链路全程成功（见 #6-#19）
- [PASS] #25 ONLINE 记录置 EXPIRED（历史保留，不删除）
- [PASS] #25b Admin 重新核验 (Re-verification) 成功
- [PASS] #25c 历史记录保留（EXPIRED 旧行仍在 + 新 ACTIVE 行）  :: rows=3
- [PASS] 审计·谁审核(actor_email=admin)  :: actor=cs22c-adm-sndy4y@example.com
- [PASS] 审计·审核什么(action 全覆盖)  :: acts=ASSESSMENT_REVIEW_SAVED,ASSESSMENT_NEEDS_MORE_INFO,ONLINE_VERIFICATION_APPROVED,ON_SITE_VERIFICATION_APPROVED,ONLINE_VERIFICATION_APPROVED
- [PASS] 审计·什么时候(created_at 非空)
- [PASS] 审计·什么结果(metadata 含 verification_id)
- [PASS] 不进 sitemap（slug 不在 sitemap.xml）  :: slug=cs-c-test-do-not-publish
- [PASS] 不进公开 Supplier 列表（legal_name 不出现）  :: status=200
- [PASS] 公开查询(is_published=true)不含本 Supplier