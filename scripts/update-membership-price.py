# -*- coding: utf-8 -*-
"""
统一修改 Buyer Membership（Founding Buyer）价格。

背景：$49 → $99 时，价格散落在 3 个地方，共 48 处：
  1. lib/suppliers.ts 的 MEMBERSHIP_PRICE_USD 常量（页面大号价格 + membership 页 JSON-LD）
  2. 9 份字典 × 5 处文案（supplierProfile.paidLockLead / register.membershipLink /
     membership.metaTitle / membership.metaDesc / membership.faq[0].a）
  3. 已全部改为引用常量的：app/llms.txt/route.ts、lib/notify.ts（本脚本不再处理）

各语言的价格书写格式不同，必须分别匹配，不能简单全局替换 "49"：
  en/ja/zh/zh-TW  $49          es/de/fr  49 $        pt  US$ 49        ar  49$

用法：
  python scripts/update-membership-price.py [旧价] [新价]
  python scripts/update-membership-price.py 99 149     # 下次调价
  python scripts/update-membership-price.py            # 默认 49 → 99
"""

import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 语言 → [(旧价格写法, 新价格写法)]，顺序敏感：先匹配更具体的（如 pt 的 "US$ 49"）
LANG_PATTERNS = {
    "en": [(r"\$49", "$99")],
    "zh": [(r"\$49", "$99")],
    "zh-TW": [(r"\$49", "$99")],
    "ja": [(r"\$49", "$99")],
    "es": [(r"49\s*\$", "99 $")],
    "de": [(r"49\s*\$", "99 $")],
    "fr": [(r"49\s*\$", "99 $")],
    "pt": [(r"US\$\s*49", "US$ 99")],
    "ar": [(r"49\s*\$", "99$")],
}

# 生成规则时把占位数字换成实参，保持各语言的 "$ 在前 / 在后 / US$ 前缀" 习惯
def build_patterns(old: str, new: str) -> dict:
    pats = {}
    for lang, rules in LANG_PATTERNS.items():
        out = []
        for pattern, template in rules:
            # 模板里出现的 99 / 49 分别对应 new / old
            p = pattern.replace("49", old)
            t = template.replace("99", new).replace("49", old)
            out.append((p, t))
        pats[lang] = out
    return pats


def update_constant(old: str, new: str) -> bool:
    path = os.path.join(ROOT, "lib", "suppliers.ts")
    text = io.open(path, encoding="utf-8", newline="").read()
    pat = re.compile(r"(export const MEMBERSHIP_PRICE_USD\s*=\s*)" + re.escape(old) + r"\s*;")
    new_text, n = pat.subn(lambda m: m.group(1) + new + ";", text, count=1)
    if n == 0:
        print(f"[warn] lib/suppliers.ts 未找到 MEMBERSHIP_PRICE_USD = {old}")
        return False
    io.open(path, "w", encoding="utf-8", newline="").write(new_text)
    print(f"[done] lib/suppliers.ts: MEMBERSHIP_PRICE_USD {old} → {new}")
    return True


def update_dicts(old: str, new: str) -> int:
    pats = build_patterns(old, new)
    total = 0
    for lang, rules in pats.items():
        path = os.path.join(ROOT, "i18n", "dictionaries", f"{lang}.json")
        if not os.path.exists(path):
            print(f"[skip] {lang}: 文件不存在")
            continue
        text = io.open(path, encoding="utf-8", newline="").read()
        original = text
        count = 0
        for pattern, template in rules:
            text, n = re.subn(pattern, template.replace("\\", "\\\\"), text)
            count += n
        # 安全检查：替换后不应再残留旧价格
        leftover = len(re.findall(r"(?<![0-9])" + re.escape(old) + r"(?![0-9])", text))
        if text != original:
            io.open(path, "w", encoding="utf-8", newline="").write(text)
        print(f"[done] {lang}: 替换 {count} 处，残留旧价 {leftover}")
        total += count
    return total


def main() -> int:
    old = sys.argv[1] if len(sys.argv) > 1 else "49"
    new = sys.argv[2] if len(sys.argv) > 2 else "99"
    if not (old.isdigit() and new.isdigit()):
        print("用法: python scripts/update-membership-price.py [旧价] [新价]")
        return 1
    print(f"=== Founding Buyer 价格 {old} → {new} ===")
    update_constant(old, new)
    n = update_dicts(old, new)
    print(f"\n字典共替换 {n} 处")
    return 0


if __name__ == "__main__":
    sys.exit(main())
