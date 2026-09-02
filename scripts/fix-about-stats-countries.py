# -*- coding: utf-8 -*-
"""
把 About 页 stats 里的「9 覆盖国家」改成真实覆盖国数量（派生自 lib/coverage.ts）。

背景（数字声明审计）：
  lib/coverage.ts 的 COVERAGE_COUNTRIES 只有 5 国（中/越/泰/马/菲），
  但 9 份字典的 about.stats[0].value 写的是 9，来源是被废弃的 STATIC_COUNTRIES（9 国，
  含印度/孟加拉/土耳其/印尼/巴基斯坦/墨西哥）。属于「无据声称」，必须改。

用法： python scripts/fix-about-stats-countries.py
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT_DIR = os.path.join(ROOT, "i18n", "dictionaries")
BACKUP_DIR = os.path.join(ROOT, ".workbuddy", "dict-backup-before-aboutstats")


def count_coverage_countries() -> int:
    """从 lib/coverage.ts 解析 COVERAGE_COUNTRIES 的条目数（唯一事实来源）。"""
    src = io.open(os.path.join(ROOT, "lib", "coverage.ts"), encoding="utf-8").read()
    start = src.index("export const COVERAGE_COUNTRIES")
    # 数组起止：从 `=` 之后再找第一个 [，否则会命中类型注解 CoverageCountry[] 里的方括号
    eq = src.index("=", start)
    arr_start = src.index("[", eq)
    depth = 0
    for i in range(arr_start, len(src)):
        if src[i] == "[":
            depth += 1
        elif src[i] == "]":
            depth -= 1
            if depth == 0:
                arr = src[arr_start : i + 1]
                break
    else:
        raise RuntimeError("COVERAGE_COUNTRIES 数组未闭合")
    codes = re.findall(r'^\s{2,4}code:\s*"([a-z]+)"', arr, flags=re.M)
    return len(set(codes)), sorted(set(codes))


def main() -> int:
    n, codes = count_coverage_countries()
    print("COVERAGE_COUNTRIES = %d 国: %s" % (n, ", ".join(codes)))
    # 安全阀：解析不出合理数量就中止，绝不写脏数据（曾因解析器 bug 把 9 份字典写成 0）
    if not 1 <= n <= 30:
        raise SystemExit("解析出的覆盖国数量异常（%d），已中止，未修改任何字典" % n)

    os.makedirs(BACKUP_DIR, exist_ok=True)
    changed = 0

    for name in sorted(os.listdir(DICT_DIR)):
        if not name.endswith(".json"):
            continue
        path = os.path.join(DICT_DIR, name)
        # newline="" —— Windows 上必须显式声明，否则 CRLF 会被读成 LF 并在写回时被改写
        text = io.open(path, encoding="utf-8", newline="").read()
        data = json.loads(text)

        stats = (data.get("about") or {}).get("stats")
        if not isinstance(stats, list) or not stats:
            print("  SKIP %s: about.stats 缺失" % name)
            continue

        first = stats[0]
        old_val = str(first.get("value", ""))
        # 只认「数字」形态的旧值；已经是正确值就跳过
        if old_val == str(n):
            print("  OK   %s: 已是 %s（%s）" % (name, old_val, first.get("label")))
            continue
        if not re.fullmatch(r"\d+(?:\+)?", old_val.strip()):
            print("  SKIP %s: value 不是纯数字 -> %r" % (name, old_val))
            continue

        # 精确文本替换：只改 about.stats 第一项的 value，整份文件不做 round-trip
        needle = '"value": "%s"' % old_val
        if text.count(needle) != 1:
            # 退化情形：用缩进定位到 about.stats 块内的那一行
            block = re.search(
                r'"stats":\s*\[\s*\{\s*"value":\s*"%s"' % re.escape(old_val), text
            )
            if not block:
                print("  FAIL %s: needle 命中 %d 次，无法唯一定位" % (name, text.count(needle)))
                continue
            start, end = block.span()
            seg = text[start:end]
            new_seg = seg.replace('"%s"' % old_val, '"%d"' % n)
            new_text = text[:start] + new_seg + text[end:]
        else:
            new_text = text.replace(needle, '"value": "%d"' % n)

        if new_text == text:
            print("  FAIL %s: 替换后无变化" % name)
            continue

        # 写回前先备份
        bak = os.path.join(BACKUP_DIR, name)
        if not os.path.exists(bak):
            io.open(bak, "w", encoding="utf-8", newline="").write(text)

        io.open(path, "w", encoding="utf-8", newline="").write(new_text)

        # 复核：CRLF 数不变 + JSON 可解析 + 值正确
        raw = io.open(path, "rb").read()
        crlf = raw.count(b"\r\n")
        bare = raw.count(b"\n") - crlf
        check = json.loads(io.open(path, encoding="utf-8", newline="").read())
        new_val = str((check["about"]["stats"][0]).get("value"))
        status = "OK" if (new_val == str(n) and bare == 0) else "FAIL"
        print(
            "  %s  %s: %s -> %s (%s) CRLF=%d bareLF=%d"
            % (status, name, old_val, new_val, check["about"]["stats"][0].get("label"), crlf, bare)
        )
        if status == "OK":
            changed += 1

    print("\n完成：%d 份字典更新为 %d 国。备份在 %s" % (changed, n, BACKUP_DIR))
    return 0 if changed else 1


if __name__ == "__main__":
    sys.exit(main())
