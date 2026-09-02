#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
扫描 page/component 里硬编码的英文文案。

命中三类：
  1. JSX 文本节点   <h2>Some English</h2>
  2. 无障碍/提示属性 placeholder / aria-label / title / alt
  3. {"字面量"} 形式的 JSX 表达式文本

用法:
  python scripts/scan_hardcoded_en.py
  python scripts/scan_hardcoded_en.py --dir components
输出: .workbuddy/hardcoded-en.json / 控制台摘要
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, ".workbuddy", "hardcoded-en.json")

# 至少含 2 个「单词」或 1 个带空格的词组，才算文案（过滤单字符/符号）
WORD_RE = re.compile(r"[A-Za-z]{2,}")
TEXT_NODE_RE = re.compile(r">([^<>{}]*[A-Za-z][^<>{}]*)<")
ATTR_RE = re.compile(
    r'\b(?:placeholder|aria-label|title|alt|label)\s*=\s*"([^"]*[A-Za-z][^"]*)"'
)
JSX_STR_RE = re.compile(r'\{\s*"([^"]{3,}[A-Za-z][^"]*)"\s*\}')

# 这些文件名/目录不参与扫描
SKIP_DIRS = {"node_modules", ".next", ".open-next", ".git", ".workbuddy", "scripts"}
# 明显不是文案的值
STOPWORDS = {
    "en", "zh", "es", "de", "fr", "pt", "ja", "ar", "zh-TW", "utf-8", "div", "span",
    "GET", "POST", "application/json", "text/html", "icon", "image/png",
}
# 单个 token 且是品牌/缩写，忽略
BRANDISH = re.compile(
    r"^(?:[A-Z][A-Za-z]*){1,3}$"
)
IGNORE_EXACT = {
    "FactoryAuditB2B", "RFQ", "ISO", "BSCI", "Sedex", "PDF", "ID", "URL",
    "WhatsApp", "LinkedIn", "Facebook", "YouTube", "Google", "Email",
}


def looks_like_copy(text: str) -> bool:
    t = text.strip()
    if not t or t in IGNORE_EXACT:
        return False
    if t.lower() in STOPWORDS:
        return False
    words = WORD_RE.findall(t)
    if not words:
        return False
    # 单个词且像类名/变量名（含 - 或 camelCase 且无空格）
    if " " not in t and ("-" in t or "_" in t or re.match(r"^[a-z]+[A-Z]", t)):
        return False
    # 纯大写缩写
    if len(t) <= 4 and t.upper() == t:
        return False
    # 至少一个「英文实词」长度 >=3
    if not any(len(w) >= 3 for w in words):
        return False
    return True


def scan_file(path: str):
    try:
        src = open(path, encoding="utf-8").read()
    except Exception:  # noqa: BLE001
        return []
    hits = []
    lines = src.split("\n")
    for m in TEXT_NODE_RE.finditer(src):
        val = m.group(1)
        if looks_like_copy(val):
            ln = src[: m.start()].count("\n") + 1
            hits.append({"file": path, "line": ln, "type": "text",
                         "value": val.strip()[:160],
                         "code": lines[ln - 1].strip()[:160]})
    for kind, rx in (("attr", ATTR_RE), ("jsx-str", JSX_STR_RE)):
        for m in rx.finditer(src):
            val = m.group(1)
            if looks_like_copy(val):
                ln = src[: m.start()].count("\n") + 1
                hits.append({"file": path, "line": ln, "type": kind,
                             "value": val.strip()[:160],
                             "code": lines[ln - 1].strip()[:160]})
    return hits


def main():
    target = ROOT
    if "--dir" in sys.argv:
        target = os.path.join(ROOT, sys.argv[sys.argv.index("--dir") + 1])
    all_hits = []
    for dirpath, dirnames, filenames in os.walk(target):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if fn.endswith((".tsx", ".jsx")):
                all_hits.extend(scan_file(os.path.join(dirpath, fn)))
    all_hits.sort(key=lambda h: (h["file"], h["line"]))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(all_hits, fh, ensure_ascii=False, indent=2)
    print(f"命中 {len(all_hits)} 处硬编码英文 → {OUT}")
    by_file = {}
    for h in all_hits:
        by_file.setdefault(os.path.relpath(h["file"], ROOT), []).append(h)
    for f in sorted(by_file, key=lambda x: -len(by_file[x]))[:25]:
        print(f"  {len(by_file[f]):3d}  {f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
