# 批 4.3 写入器就绪报告 + 60 条 desc 校验结果

> 状态：**写入器已就绪、尚未落盘**。`lib/guides.ts` 字节未变（sha256 前后一致），
> 数据库未写任何行。等待确认后执行「写入 → 七步构建 → 部署」。
>
> 生成时间：2026-09-29　范围：guides #21–30 十篇 × 6 语 = 60 条 `metaDesc*`

---

## 1. 交付物清单

| 文件 | 性质 | 说明 |
|---|---|---|
| `scripts/translate-guides-batch43.cjs` | 新增（待入库） | 批 4.3 写入器，内联 60 条数据；支持 `--dry` |
| `scripts/_g43_data.cjs` | 探针（gitignore） | 60 条候选原文 |
| `scripts/_g43_check.cjs` | 探针（gitignore） | 独立第二校验器（不复用写入器代码） |
| `scripts/_g43_probe.cjs` | 探针（gitignore） | 插入锚点只读探针 |

**源文件零改动证据**
```
dry 前 sha256: ed0c9278c78110f2199245a0371942cdbc5e7fb98a6326c80e4d413eb58f7039  lib/guides.ts
dry 后 sha256: ed0c9278c78110f2199245a0371942cdbc5e7fb98a6326c80e4d413eb58f7039  lib/guides.ts
```
（`lib/guides.ts.bak` 是批 4.2 遗留，已被 `.gitignore` 的 `lib/*.bak` 覆盖，非本轮产生。）

---

## 2. 60 条 desc 合规校验结果

**结论：60/60 全绿，不合规 0。**

| 判定项 | 结果 |
|---|---|
| 口径区间 | ja 60–90 ／ es·de·fr·pt 120–158 ／ **ar 90–158**（本轮裁决，ar 免 120 下限） |
| 实测区间 | ja **62–73** ／ es **127–158** ／ de **120–147** ／ fr **130–158** ／ pt **121–152** ／ ar **112–149** |
| 越上限 | 0 |
| 越下限 | 0 |
| 双句结构 | 60/60（两条句末标点） |
| 句末标点收尾 | 60/60 |
| 破折号（— / –） | 0 处 |
| 悬空尾标点 | 0 处 |
| 预算判定一致 | 60/60（`metaDescriptionBudget()` 口径：CJK 占比 > 10% → 90，否则 158） |

### 逐条长度表

| # | slug | ja | es | de | fr | pt | ar |
|---|---|---:|---:|---:|---:|---:|---:|
| 21 | brand-reputation-pr-crisis | 66 | 146 | 135 | 144 | 136 | 113 |
| 22 | chinese-supplier-scam-red-flags | 67 | 140 | 135 | 139 | 138 | 149 |
| 23 | how-to-check-china-company-registration | 67 | 154 | 140 | 152 | 147 | 136 |
| 24 | alibaba-trade-assurance-safe-payment | 73 | 157 | 141 | 153 | 141 | 117 |
| 25 | verify-supplier-before-deposit | 62 | 153 | 136 | 147 | 152 | 115 |
| 26 | common-b2b-procurement-fraud | 65 | 158 | 147 | 158 | 147 | 131 |
| 27 | what-is-quality-management-system | 62 | 155 | 140 | 148 | 151 | 119 |
| 28 | iso-9001-vs-iso-13485 | 65 | 127 | 120 | 130 | 121 | 112 |
| 29 | manufacturing-quality-control-process | 69 | 135 | 133 | 141 | 134 | 128 |
| 30 | ppap-production-part-approval | 68 | 134 | 140 | 147 | 131 | 131 |

### 一个需你确认的历史项（非本轮新增）

`ppap-production-part-approval` 的 **es/de/pt 原稿**为 115/112/114，低于 120 下限，
上一轮已就地补足为 **134/140/131**（同义信息追加，未改语义、未加营销词）。
本轮的 60 条 = 该补足版。如你要求回退到原稿，需重写这三条。

---

## 3. 插入锚点（只读实测）

`_g43_probe.cjs` 对 10 篇逐一核验三件事：slug 块存在、`metaDescZh` 值行可解析、尚无 `metaDescJa`。

```
ok  brand-reputation-pr-crisis            block=3049–3157  zh@3056  zhLen=52  zhFmt=multiline  已有Ja=false  已有En=true
ok  chinese-supplier-scam-red-flags       block=3158–3262  zh@3165  zhLen=42  zhFmt=multiline  已有Ja=false  已有En=true
ok  how-to-check-china-company-registration block=3263–3366 zh@3270  zhLen=50  zhFmt=multiline  已有Ja=false  已有En=true
ok  alibaba-trade-assurance-safe-payment  block=3367–3470  zh@3374  zhLen=54  zhFmt=multiline  已有Ja=false  已有En=true
ok  verify-supplier-before-deposit        block=3471–3576  zh@3478  zhLen=39  zhFmt=multiline  已有Ja=false  已有En=true
ok  common-b2b-procurement-fraud          block=3577–3680  zh@3584  zhLen=45  zhFmt=multiline  已有Ja=false  已有En=true
ok  what-is-quality-management-system     block=3681–3785  zh@3689  zhLen=51  zhFmt=multiline  已有Ja=false  已有En=true
ok  iso-9001-vs-iso-13485                 block=3786–3889  zh@3793  zhLen=56  zhFmt=multiline  已有Ja=false  已有En=true
ok  manufacturing-quality-control-process block=3890–3993  zh@3897  zhLen=53  zhFmt=multiline  已有Ja=false  已有En=true
ok  ppap-production-part-approval         block=3994–4101  zh@4001  zhLen=53  zhFmt=multiline  已有Ja=false  已有En=true
[锚点探针] 目标 10 篇，异常 0
```

**插入位置**：一律插在 `metaDescZh` 值行之后（10 篇均为**多行写法**，无内联混用风险），
每篇 6 组共 **12 行**（`metaDescJa:` 键行 + 缩进值行，×6 语）⇒ 全批新增 **120 行**。
字段顺序与批 4.1/4.2 完全一致（Ja→Es→De→Fr→Pt→Ar）。

---

## 4. 写入器设计（`translate-guides-batch43.cjs`）

沿用批 4.2 骨架，**本批无「值替换」项**（纯新增），因此去掉了 `JA_FIX` 与重叠检查。

| 层 | 机制 |
|---|---|
| 数据 | 内联常量 `DATA43`，不依赖任何一次性文件 / 外部 API |
| 写前自检 | 60 条全量：长度上下限（ja 60／ar 90／其他 120；上限 ja 90／其他 158）+ 句末标点 + 无破折号 + 无悬空尾标点；**任一条不合规 → exit 1 且不写文件** |
| 幂等 | 目标篇若已存在 `metaDescJa` 整组 → 跳过该篇（重复跑不重复插入） |
| 反演校验 | 摘掉插入行（升序 + 位移累计）后必须与原文**逐行相等**；否则拒绝写入 |
| 备份 | 写入前 `lib/guides.ts` → `lib/guides.ts.bak` |
| 读回校验 | 写后逐条比对 60 条，不一致自动从备份还原 |
| 行尾 | CRLF/LF 原样保持（现文件为 **CRLF**，与 `cs13 F1d` 要求一致） |
| `--dry` | 校验 + 打印锚点规划，不写文件（本报告即其输出） |

### dry-run 实测输出

```
批 4.3：新增 10 篇 × 6 语 = 60 条
[写前自检] 共 60 条，不合规 0
--dry：校验通过，未写文件。锚点规划如下（插入于 metaDescZh 值行之后，行号从 1 计）：
  · brand-reputation-pr-crisis                   metaDescZh 值行 @ 3056  → 插入 12 行
  · chinese-supplier-scam-red-flags              metaDescZh 值行 @ 3165  → 插入 12 行
  · how-to-check-china-company-registration      metaDescZh 值行 @ 3270  → 插入 12 行
  · alibaba-trade-assurance-safe-payment         metaDescZh 值行 @ 3374  → 插入 12 行
  · verify-supplier-before-deposit               metaDescZh 值行 @ 3478  → 插入 12 行
  · common-b2b-procurement-fraud                 metaDescZh 值行 @ 3584  → 插入 12 行
  · what-is-quality-management-system            metaDescZh 值行 @ 3689  → 插入 12 行
  · iso-9001-vs-iso-13485                        metaDescZh 值行 @ 3793  → 插入 12 行
  · manufacturing-quality-control-process        metaDescZh 值行 @ 3897  → 插入 12 行
  · ppap-production-part-approval                metaDescZh 值行 @ 4001  → 插入 12 行
待插入 10 篇（已存在跳过 0），共 120 行。行尾=CRLF
```

> 本轮发现并已修：写入器初版把 `ar` 也套用了 120 下限（沿用了批 4.2 的 `minOf`），
> dry-run 立刻在 5 条 ar 上报错并**拒绝写入**（113/117/115/119/112 < 120）。
> 已按本轮裁决加 `DESC_AR_MIN = 90`。此即「写前自检真的在拦」。

---

## 5. 确认后要执行的动作（尚未执行）

1. `node scripts/translate-guides-batch43.cjs`（去掉 `--dry`）→ 新增 120 行
2. `scripts/g4-desc-idempotency-regression.ts` 的 `EXPECTED` 由 **120 提至 180**
3. `tsc --noEmit` → EXIT 0
4. 七步构建（与任务包 2 的数据改动**合并为一次重建**）：
   `with-proxy.cjs` preload + 显式 `FAB2B_PROXY`；构建后必数
   `/guides/*.html = 423`、`/suppliers/*.html = 99`（任务包 2 后）、en 字典叶子 = **3126**
5. 部署 → 跑 `g4-desc-idempotency-regression` + `live-meta-verify`（4 页）+ 回归无新增失败

---

## 6. 风险与未解决问题

| # | 风险 / 未决 | 说明 |
|---|---|---|
| R1 | `EXPECTED` 120→180 的时机 | 必须先写入再改常量；若两件事分开做，中间态回归必 FAIL（预期，非故障） |
| R2 | 与任务包 2 共用一个重建 | 两包的构建窗口必须合并；分开构建会导致 `/suppliers/*.html` 计数与实际库不一致 |
| R3 | `ar` 下限口径 | 本轮按 90 执行。批 4.1 的 ar 实测为 91–111，与本轮 112–149 同区间，口径已对齐，无需回改 |
| R4 | `<title>` 仍为英文 | 独立的遗留工作项，本批不触碰 |
| R5 | 剩余缺口 | 批 4.3 完成后仍余 **17 篇 × 6 语 = 102 页**（批 4.4 / 4.5） |
