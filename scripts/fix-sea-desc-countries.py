# -*- coding: utf-8 -*-
"""
修 resourcesIndex.cat.sea.desc：9 语都写了「越南 + 泰国」，
但 sea 类目实际只有 1 篇指南（How to Audit a Factory in Vietnam），
属无据声称（禁无据声称铁律）→ 改为只提越南。

顺带：
- ja 原文是机翻渣（把名词当动词："越南和泰国正在采购..."）→ 重写为通顺日语
- ar 原文带 ":: " 前缀 → 去掉

铁律：
- 读写都加 newline=""，避免 CRLF 被改写
- 精确文本替换（键名锚定），不 round-trip JSON
- 改前备份，改后校验行尾与 JSON 可解析
"""
import io, json, os, shutil, sys

DICT_DIR = "i18n/dictionaries"
BACKUP_DIR = ".workbuddy/dict-backup-before-seadesc"

# locale -> (旧值, 新值)
PLAN = {
    "en": (
        "Vietnam and Thailand sourcing context, risks and audit considerations.",
        "Vietnam sourcing context, risks and audit considerations.",
    ),
    "zh": (
        "越南与泰国的采购背景、风险与验厂注意事项。",
        "越南的采购背景、风险与验厂注意事项。",
    ),
    "zh-TW": (
        "越南與泰國的採購背景、風險與驗廠注意事項。",
        "越南的採購背景、風險與驗廠注意事項。",
    ),
    "es": (
        "Contexto de abastecimiento, riesgos y consideraciones de auditoría de Vietnam y Tailandia.",
        "Contexto de abastecimiento, riesgos y consideraciones de auditoría en Vietnam.",
    ),
    "de": (
        "Vietnam und Thailand Beschaffung Kontext, Risiken und Prüfung Überlegungen.",
        "Beschaffungskontext, Risiken und Prüfungsaspekte für Vietnam.",
    ),
    "fr": (
        "Contexte d'approvisionnement, risques et considérations d'audit au Vietnam et en Thaïlande.",
        "Contexte d'approvisionnement, risques et considérations d'audit au Vietnam.",
    ),
    "pt": (
        "Contexto de fornecimento do Vietnã e da Tailândia, riscos e considerações de auditoria.",
        "Contexto de fornecimento do Vietnã, riscos e considerações de auditoria.",
    ),
    "ja": (
        "ベトナムとタイは、文脈、リスク、監査の検討を調達しています。",
        "ベトナムの調達環境、リスク、監査上の注意点。",
    ),
    "ar": (
        ":: السياق المتعلق بالاستعانة بالموارد في فييت نام وتايلند، والمخاطر، واعتبارات مراجعة الحسابات.",
        "السياق المتعلق بالاستعانة بالموارد في فييت نام، والمخاطر، واعتبارات مراجعة الحسابات.",
    ),
}


def main():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    ok, fail = 0, []

    for loc, (old, new) in PLAN.items():
        path = os.path.join(DICT_DIR, "%s.json" % loc)
        raw = io.open(path, encoding="utf-8", newline="").read()

        anchor = '"desc": "%s"' % old
        hit = raw.count(anchor)
        if hit != 1:
            fail.append("%s: 锚定命中 %d 次（期望 1），跳过" % (loc, hit))
            continue
        if raw.count(old) != 1:
            fail.append("%s: 旧值在全文出现 %d 次（期望 1），跳过" % (loc, raw.count(old)))
            continue

        shutil.copyfile(path, os.path.join(BACKUP_DIR, "%s.json" % loc))
        out = raw.replace(anchor, '"desc": "%s"' % new)

        # 校验：JSON 可解析 + 行尾未被改写
        json.loads(out)
        crlf_before = raw.count("\r\n")
        crlf_after = out.count("\r\n")
        if crlf_before != crlf_after:
            fail.append("%s: CRLF 变化 %d -> %d，回滚" % (loc, crlf_before, crlf_after))
            continue

        io.open(path, "w", encoding="utf-8", newline="").write(out)
        ok += 1
        print("OK  %-6s CRLF=%d  -> %s" % (loc, crlf_after, new))

    print("\n完成 %d / %d" % (ok, len(PLAN)))
    for f in fail:
        print("FAIL " + f)
    if fail:
        sys.exit(1)


if __name__ == "__main__":
    main()
