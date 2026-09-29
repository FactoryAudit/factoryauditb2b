# 内容侧路径① · A 级发布执行方案（待确认，未执行）

> 状态：**提案阶段。数据库未写任何行**（本轮全部为 `--read-only` 查询）。
> 确认后按 §6 的顺序执行，与批 4.3 的代码改动**合并为同一次重建 + 部署**。

---

## 1. country_code 归一（3 条）

### 现状 → 目标

| slug | 现 country_code | 目标 | 归一理由 |
|---|---|---|---|
| `jisun` | `cn` | `china` | ISO 短码，本库不用 |
| `supplier` | `unknown` | `china` | 测试脏数据，国别未填 |
| `guangdong-junchi-sports-products-co-ltd` | `unknown` | `china` | 入驻表单未填国别 |

### 为什么必须归一（代码级依据）

```ts
// lib/queries.ts:187
function countryNameOf(code: string): string {
  return STATIC_COUNTRIES.find((c) => c.code === code)?.name ?? code;  // ← 兜底返回原始 code
}
```
`STATIC_COUNTRIES` 由 `COVERAGE_COUNTRIES` 映射而来，**code 值域只有 5 个全拼小写**：
`china` / `vietnam` / `thailand` / `malaysia` / `philippines`（`lib/coverage.ts:48-729`）。

⇒ `countryNameOf("cn")` 查不到 ⇒ **直接渲染出字面量 `cn`**；
`countryNameOf("unknown")` ⇒ **渲染出字面量 `unknown`**。
这是「档案页的 Country 行显示 `cn`」这类脏显示，必须归一。

### 影响面

三条**全部是 draft**（`is_published=false`），归一**不影响本次公开页面**，属前瞻性修正：
- `jisun` —— 你已裁决「保持 draft」
- `supplier` —— 测试脏数据，将标 `profile_status='rejected'`
- `guangdong-junchi-…` —— B 级「补齐后发布」，归一后将来发布即正确

### 待执行 SQL（逐条，非批量）

```sql
UPDATE suppliers SET country_code='china' WHERE slug='jisun';
UPDATE suppliers SET country_code='china' WHERE slug='supplier';
UPDATE suppliers SET country_code='china' WHERE slug='guangdong-junchi-sports-products-co-ltd';
```

> 范围限定：`WHERE slug=...` 精确定位（非 `IN`），三条分开跑，每条的 `UPDATE 1` 单独留痕。
> 不动 `country` 列（该列本库为空／不参与渲染），不改任何其他字段。

### 归一前后对照（当前实测值）

```
guangdong-junchi-sports-products-co-ltd  country_code=unknown  is_published=false  profile_status=draft
jisun                                    country_code=cn       is_published=false  profile_status=draft
supplier                                 country_code=unknown  is_published=false  profile_status=draft
```

---

## 2. `english_name` 改动建议（`u-w-y-company-limited`）

### 提案

| | 值 |
|---|---|
| **现状** | `UWYES — the professional display brand of U.W.Y Company Limited` |
| **建议** | `UWYES` |

**理由（三条，均与本项目既有铁律直接冲突）**
1. **破折号 `—`** —— 项目铁律「禁破折号修辞」。
2. **营销语** —— `the professional display brand of …` 是自我宣称，
   而本页对该企业的核验等级是 `unverified`（0/4），平台不能替它背书「professional」。
3. **与 `legal_name` 重复** —— `legal_name` 已是 `U.W.Y Company Limited`，
   该行重复同一实体名属于噪声。

### 影响面（已逐一核到代码，结论：**只影响 1 行 Buyer Snapshot**）

| 出口 | 是否用 `english_name` | 依据 |
|---|---|---|
| SEO `<title>` | ❌ 只用 `legal_name` | `supplierSeo.ts:612` `const name = (data.legalName ?? "").trim()` |
| meta description | ❌ 只用 `legal_name` | `supplierSeo.ts:647` 同上 |
| JSON-LD | ❌ 只用 `legal_name` | `supplierSeo.ts:1142 / 1190 / 1199` |
| Buyer Snapshot 行 | ✅ **`englishName` 行** | `supplierSeo.ts:831` `push("englishName", …)` |
| 数据覆盖度计数 | ✅ 仅判真假 | `supplierSeo.ts:939` `Boolean(data.englishName?.trim())` —— `"UWYES"` 仍为真，计数不变 |

⇒ 改动后：title / description / JSON-LD / 覆盖度**全部不变**，
只有 Snapshot 的 English Name 行由「`UWYES — the professional display brand of U.W.Y Company Limited`」
变为「`UWYES`」。

### 待执行 SQL

```sql
UPDATE suppliers SET english_name='UWYES' WHERE slug='u-w-y-company-limited';
```

### 需要你确认的一点

`UWYES` 是**品牌名**，不是公司名；改完后该行会显示一个与 `legal_name`（U.W.Y Company Limited）
不同的短品牌词。若你更希望该行显示完整英文公司名，替代值是 `U.W.Y Company Limited`（＝与 legal_name 相同，
覆盖度仍为真，但该行与 Legal name 行内容重复）。**我建议 `UWYES`**（保留品牌信息、去破折号与营销语）。

---

## 3. A 级 2 家发布

### 待发布对象（实测可发布性）

| slug | legal_name | country | city | industry | vlevel | risk |
|---|---|---|---|---|---|---|
| `u-w-y-company-limited` | U.W.Y Company Limited | china | Shenzhen, Guangdong | electronics | unverified | NULL |
| `xiamen-jintaijin-polish-tech-co-ltd` | Xiamen Jintaijin Polish Tech Co., Ltd. | china | Xiamen | machinery | unverified | NULL |

两者均具备：`legal_name` / `country_code=china` / `city` / `industry_code` / `main_products` /
`website`，且 `supplier_consents` 已留痕（`supplier_profile` v1.0，`consent_given=true`）。

> ⚠️ 两者 `risk_score` 均为 **NULL** ⇒ 页面**不会**出现评分（`RowToView` 保持 `undefined`，绝不 `?? 0`）。
> `verification_level=unverified` ⇒ 页面显示「未核验」（0/4）。这是诚实的表达，符合本平台规则。

### 待执行 SQL

```sql
UPDATE suppliers
SET is_published=true, profile_status='public'
WHERE slug IN ('u-w-y-company-limited', 'xiamen-jintaijin-polish-tech-co-ltd');
```

> `is_published` **显式传 `true`**（该列 DEFAULT 为 `true`，但不依赖默认值 —— 显式写死，可审计）。

### 计数预期

- 现：9 家已发布 ⇒ `/suppliers/*.html = 81`（9 × 9 语）
- 后：11 家已发布 ⇒ **`/suppliers/*.html = 99`**（11 × 9 语）
- `/guides/*.html` 保持 **423**

---

## 4. 测试脏数据标记（4 条，不删除）

```sql
UPDATE suppliers
SET profile_status='rejected'
WHERE slug IN ('supplier', 'step12-automated-verify-co',
               'xiamen-jintaijin-polish-tech-co-ltd-1',
               'xiamen-jintaijin-polish-tech-co-ltd-2');
```

| slug | 判定 | 理由 |
|---|---|---|
| `supplier` | 测试 | 占位 slug，非企业名 |
| `step12-automated-verify-co` | 测试 | STEP12 自动化验证会话产物 |
| `xiamen-jintaijin-polish-tech-co-ltd-1` | 测试 | 与正式 slug 重复导入 |
| `xiamen-jintaijin-polish-tech-co-ltd-2` | 测试 | 同上 |

**约束遵守**：只改 `profile_status`，**不删除任何行**、不改 `is_published`（已全为 `false`）、
不触碰任何非空业务字段。四条均无公开影响（公开读唯一闸门是 `is_published=true`）。

> 说明：`rejected` 是本库已存在的状态值（`profile_status` 值域含 `draft` / `public` / `rejected`），
> 不是新造枚举；无需 migration。

---

## 5. 重建 + 部署

1. 清 `.next/cache`（**SSG 冻结**：库内容变更后必须重建，否则预渲染固化旧库且零报错）
2. 与任务包 1（批 4.3 代码）**合并为同一次重建**
3. 构建后必数：`/suppliers/*.html = 99`、`/guides/*.html = 423`、en 字典叶子 **3126**
4. 部署后线上验收 4 页（含 2 张新供应商页：`u-w-y-company-limited`、`xiamen-jintaijin-polish-tech-co-ltd`）

---

## 6. 执行顺序（确认后）

```
①  UPDATE country_code × 3           → 逐条 read-only 复核
②  UPDATE english_name × 1           → 复核
③  UPDATE is_published/profile_status × 2（发布）  → 复核 is_published=true 且 profile_status='public'
④  UPDATE profile_status × 4（脏数据）→ 复核 rowcount=4
⑤  批 4.3 写入器落盘（任务包 1）
⑥  EXPECTED 120→180
⑦  tsc --noEmit
⑧  七步构建（一次）
⑨  部署 + 线上验收 + 回归
```

每一步 `UPDATE` 后立刻回读目标行，确认「改到了」且「只改到该行」；
若任一步 rowcount ≠ 预期，**停止后续步骤并汇报**。

---

## 7. 风险与未决

| # | 风险 / 未决 | 说明 |
|---|---|---|
| R1 | 发布后页面「未核验 + 无评分」 | 这是数据真实状态，非缺陷；但会让 2 张新页的信噪比偏低，属预期 |
| R2 | 脏数据 4 条只标记不删 | 若将来要 `DELETE`，需另开一次带备份的作业；本轮不做 |
| R3 | `english_name` 值需你拍板 | `UWYES`（建议）vs `U.W.Y Company Limited`（与 legal_name 重复） |
| R4 | B 级 4 家未处理 | `qingdao-xiuxinyang-…`／`guangdong-junchi-…`／`shenzhen-jorigin-packaging`／`loomeami` 仍待补字段 |
| R5 | 顺带修正的技能 | 无 |
