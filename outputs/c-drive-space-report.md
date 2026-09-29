# C 盘空间体检报告

> 采集时间：2026-09-29 23:30 – 23:52
> 方法：`robocopy /L /S /BYTES`（只列举、不复制、不改动）+ `PowerShell Get-ChildItem`（只读）
> **本次体检未删除、未移动、未重命名任何文件。**

---

## 一、结论先行

**C 盘只剩 1.84 GB，已用 98.8%。** 这不是"有点脏"，是濒临写满 —— 再满一点会导致 Windows 更新失败、`Temp` 写不进去、Node/Python 装依赖直接失败。

```
C:   总 159.7 GB   已用 157.9 GB   可用 1.84 GB
```

空间分布（顶层）：

| 目录 | 体积 |
|---|---|
| `C:\Users` | **72.9 GB** |
| `C:\Windows` | 24.2 GB |
| `C:\Program Files` | 14.5 GB |
| **`C:\Temp`** | **10.3 GB** |
| `C:\Program Files (x86)` | 8.9 GB |
| `C:\ProgramData` | 3.4 GB |
| `swapfile.sys`（系统托管） | 0.25 GB |

`C:\Users\35726` 内部：

| 子目录 | 体积 |
|---|---|
| `AppData` | **48.6 GB** |
| `.workbuddy` | **14.2 GB** |
| `Documents` | 2.99 GB |
| `WorkBuddy` | 1.92 GB |
| `.cache` / `.config` / `.local` | 825 / 816 / 775 MB |
| `Downloads` | 672 MB |
| `.agent-browser` / `.vscode` / `.nuget` | 428 / 375 / 321 MB |
| `.codebuddy` / `.kimi-work` / `.codex` / `.trae-cn` / `.emgm3` / `.windsurf` | 195 / 141 / 121 / 116 / 85 / 71 MB |

---

## 二、梯队一：明确可回收（可再生缓存 / 日志）≈ **12.5 GB**

这些丢了会重建，不丢数据。**风险最低，建议优先清。**

| 项 | 体积 | 佐证 |
|---|---|---|
| `.workbuddy\logs` | **4.9 GB** | 纯日志（1495 文件）；最大单文件 48 MB；内含 `.expired-*` 已过期目录 |
| `AppData\Local\npm-cache` | 1.71 GB | npm 包缓存，可再生 |
| `.workbuddy\traces` | 766 MB | 追踪数据 |
| `AppData\Local\uv` + `AppData\Roaming\uv` | 760 MB | uv 包缓存；**2026-05-24 后未动** |
| `AppData\Local\Quark` | 651 MB | 夸克浏览器缓存；**2025-02-13 后未动** |
| `AppData\Local\app_shell_cache_6383` | 590 MB | 名字即 cache；**2024-10-10 后未动**（近 2 年） |
| `@genieworkbuddy-desktop-updater` | 506 MB | 旧版安装包残留；**2026-04-28 后未动** |
| AppData 各 `*-updater`（houyicaiji / octopus / realsofitware） | 239 MB | 旧更新器残留 |
| `AppData\Local\SuperBrowserCores` | 321 MB | 2025-05-17 后未动 |
| `.workbuddy\changes-detail` | 360 MB | 改动明细缓存 |
| `.workbuddy\file-history` | 211 MB | 文件历史（13024 文件） |
| `.workbuddy\blobs` | 191 MB | 内容哈希缓存 |
| `.workbuddy\file-tree-manifests` | 169 MB | 文件树清单 |
| `.workbuddy\clipboard-images` | 136 MB | 剪贴板图片（995 文件） |
| `AppData\Local\Temp` | 86 MB | 临时文件 |
| `.workbuddy\app\Crashpad\reports` | 42 MB | 崩溃转储 |
| `.workbuddy` 其它 CLI 残留（`.kimi-work`/`.codex`/`.trae-cn`/`.emgm3`/`.windsurf`/`.agent-browser`） | ~960 MB | 需你确认是否还用这些工具 |
| `AppData\Local\CrashDumps` | 36 MB | 崩溃转储 |
| `C:\Windows\SoftwareDistribution\Download` | 24 MB | 更新下载残留 |
| `C:\Windows\Temp` | 2 MB | 系统临时 |

### 建议的最小风险第一步：**≈ 7.4 GB**

```
① .workbuddy\logs        4.9 GB   （保守做法：只删今天以外的日期目录）
② AppData\Local\npm-cache 1.71 GB
③ AppData\Local\uv + Roaming\uv  760 MB
```

只做这三项，可用空间就从 **1.84 GB → 约 9.2 GB**。

---

## 三、梯队二：**你自己的构建产物**（不是垃圾，需你判断）10.3 GB

`C:\Temp` 不是系统临时目录，里面是你**其它项目的 build 输出**：

| 目录 | 体积 | 文件数 | 最后写入 |
|---|---|---|---|
| `C:\Temp\zhiyu_build` | 6.6 GB | 62,179 | 2026-09-21 |
| `C:\Temp\coffee_release` | 2.75 GB | 25,149 | 2026-09-23 |
| `C:\Temp\zybuild-icp` | 989 MB | 16,926 | 2026-09-24 |

里面能看到：多个 webpack 缓存（`build/cache/webpack/server-production/0.pack` 118–133 MB，还有 `build-qa2`/`build-qa3`/`build-rt`/`build-rt2`/`build-rel`/`build_test/build-ics4` 各一份 69 MB）、完整 `node_modules`（`next-swc.win32-x64-msvc.node` 各 141 MB）。

**这些是别的项目（智煜 / coffee / icp 备案）的产物，我不敢替你判断是否还要用。** 但它们确实放在 `C:\Temp` 里、且最后一次动是一周前 —— 如果这些构建已经交付或可重新生成，这是**单笔最大**的可回收项。

---

## 四、梯队三：**你的数据**（我不建议动）

| 项 | 体积 | 为什么别动 |
|---|---|---|
| `AppData\Roaming\Tencent` | **9.06 GB** | 微信 / QQ 聊天记录与收到的文件。删了**聊天记录会丢** —— 要用微信自带的「设置 → 存储空间 → 管理」 |
| `AppData\Roaming\TRAE SOLO CN` | 5.31 GB | IDE 数据 |
| `AppData\Roaming\Kingsoft` + `Local\kingsoft` | 3.3 + 1.59 GB | WPS 数据 |
| `Documents\WPSDrive` + `WPS Cloud Files` | 2.12 + 872 MB | WPS 云同步残留（`WPSDrive` 最后写入 **2023-09-03**，很可能已废弃 —— 值得你自己看一眼） |
| `AppData\Local\Programs` | 4.31 GB | 已安装程序。要清就走「设置 → 应用和功能」正常卸载 |
| `AppData\Local\Packages` | 1.13 GB | UWP 应用数据 |
| `Downloads` | 672 MB | 你的下载，需你自己扫一眼 |
| `AppData\Local\Doubao` / `Feishu` / `微信开发者工具` / `OpenAI` / `Python` / `Google` / `Microsoft` | 1.86 / 1.58 / 1.63 / 742 / 801 / 910 / 1.22 GB | 在用 App 的数据与缓存 |

---

## 五、梯队四：**绝对不要手动删**

| 项 | 体积 | 后果 |
|---|---|---|
| `C:\Windows` | 24.2 GB | 组件存储（WinSxS）**只能**用 `DISM /Online /Cleanup-Image /StartComponentCleanup` 清理，手动删会坏系统 |
| `C:\Windows\Installer` | 765 MB | MSI 缓存。删了**无法修复 / 卸载**已装软件 |
| `C:\Program Files` + `(x86)` | 23.4 GB | 已安装程序 |
| `.workbuddy\binaries` | 2.6 GB | **正在使用**的 Python / Node 运行时 —— 本机所有技能（xlsx 公式重算、金融取数、docx 生成）都依赖它 |
| `.workbuddy\plugins` | 329 MB | 技能本体 |
| `.workbuddy\app` | 496 MB | 应用本体 |
| `swapfile.sys` | 256 MB | 系统托管，删了系统自己重建 |
| `C:\$Recycle.Bin` | 0.8 MB / 2533 文件 | 回收站，从「清空回收站」走 |

---

## 六、我这次**没有**做的事

- ❌ 没有删除任何文件
- ❌ 没有移动、重命名任何文件
- ❌ 没有清理回收站
- ❌ 没有改动系统设置

按我的安全铁律，对个人目录（`User\AppData` / `Downloads` / `Documents` / 用户主目录）的**第一遍永远是只读报告**。你若要我动手，流程是：

1. 你**逐项**指定要清哪些（不接受"看着办"）
2. 我先**备份**（能打包的打包到明确路径），确认成功
3. 删除**走回收站**，不用直接抹除
4. **每批 ≤ 10 项**，每批后复核空间变化
5. 任一项失败立即停

---

## 七、方法论与局限（为了让你能复核）

- **工具取舍**：Git Bash 的 `du -sh /c/*/` 在本机跑 **8 分 34 秒仍未跑完第一个目录**（Windows 文件数太多），已弃用并终止；改用 Windows 原生 `robocopy /L /S /BYTES`（只列举，绝不复制），单目录毫秒~秒级。
- **Git Bash 坑**：参数 `/L` `/S` 会被 MSYS 当成路径转换 => 必须 `MSYS_NO_PATHCONV=1`；`cmd.exe` 调用被本机安全策略拦截，故全部改用 PowerShell 通道。
- **口径**：体积 = 该目录下全部文件的字节数之和（含隐藏文件，`/XJ` 排除符号链接环）。
- **局限**：
  - `System Volume Information`、`Documents and Settings`（junction）**统计失败** ⇒ 顶层合计 134.9 GB 略低于实际已用 157.9 GB，差额主要在此 + 未计的系统保留区。
  - 无权限读取的文件会被 robocopy 跳过 ⇒ 个别目录可能**低估**，不会高估。
  - 只做了 4 层下钻（C:\ → Users → AppData → Local/Roaming），更深的未展开。

---

## 八、顺带更正一条我之前说错的话

我先前说"建了 venv 并装了 pypinyin"—— 不准确：`C:\Users\35726\.workbuddy\binaries\python\envs\default`（540 MB，50+ 个包：`akshare`/`pandas`/`matplotlib`/`formulas`/`python-docx`/`xlrd`…）**本来就在**，是别的技能在用的既有环境。我实际只装了一个 `pypinyin 0.55.0`（约 7 MB）。

并且我当时那句存在性检查的路径写错了一层（写成 `.../versions/envs/default/...`，正确是 `.../python/envs/default/...`），于是误判为"不存在"、对既有 venv 重跑了一次 `python -m venv`。`pip list` 显示 50+ 个包都在（site-packages 未被清），但 venv 骨架文件（`Scripts\`、`pyvenv.cfg`）被重写了一遍。这是我的操作失误。

`binaries` 目录 2.6 GB **属于禁碰名单**（正在使用）。
