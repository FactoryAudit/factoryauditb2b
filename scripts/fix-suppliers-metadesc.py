# -*- coding: utf-8 -*-
"""修正 suppliers.metaDesc（供应商列表页 SEO 描述）。

问题：
- ar 整条是英文，根本没翻译。
- zh-TW / de / fr / pt / ja 是旧文案，声称覆盖「印度」等，
  但印度在 lib/coverage.ts 的 COVERAGE_ROADMAP 里是 phase 2，并非已覆盖国家。
- en / zh / es 是较新的诚实版本（承认收录量有限、引导发 RFQ），应作为基准。

做法：把 6 种语言对齐到 en 版本。json load 取旧值 → 原文精确替换（不 round-trip）。
读写两端 newline=""，否则 Windows 上 CRLF 会被改成 LF。
"""
import io
import json
import os
import shutil

BACKUP = ".workbuddy/dict-backup-before-suppliersmeta"

# en / zh / es 已是正确版本，不动
NEW = {
    "zh-TW": "瀏覽已有公司資訊、產能與查核資訊的供應商。收錄量有限：如果你要找的供應商不在其中，請發布 RFQ。",
    "de": "Durchsuchen Sie Lieferanten mit Angaben zu Unternehmen, Kapazität und Verifizierung. Die Abdeckung ist begrenzt: Senden Sie eine RFQ, falls der gesuchte Lieferant nicht gelistet ist.",
    "fr": "Parcourez les fournisseurs avec informations sur l'entreprise, les capacités et la vérification. La couverture est limitée : publiez une RFQ si le fournisseur recherché n'y figure pas.",
    "pt": "Navegue pelos fornecedores com informações de empresa, capacidade e verificação. A cobertura é limitada: envie uma RFQ se o fornecedor que procura não estiver listado.",
    "ja": "会社情報、生産能力、検証情報を掲載したサプライヤーを検索できます。掲載数は限られています。お探しのサプライヤーが見つからない場合は RFQ を投稿してください。",
    "ar": "تصفّح الموردين مع معلومات عن الشركة والقدرات والتحقق. التغطية محدودة: أرسل طلب عرض أسعار (RFQ) إذا لم يكن المورد الذي تحتاجه مدرجاً.",
}


def main():
    os.makedirs(BACKUP, exist_ok=True)
    total = 0
    for lang, new in NEW.items():
        path = os.path.join("i18n", "dictionaries", f"{lang}.json")
        raw = io.open(path, encoding="utf-8", newline="").read()
        old = json.loads(raw)["suppliers"]["metaDesc"]
        needle = '"%s"' % old
        n = raw.count(needle)
        if n != 1:
            print("[WARN] %s 旧值命中 %d 次（期望 1），跳过" % (lang, n))
            continue
        shutil.copy2(path, os.path.join(BACKUP, f"{lang}.json"))
        io.open(path, "w", encoding="utf-8", newline="").write(
            raw.replace(needle, '"%s"' % new)
        )
        total += 1
        print("[ok] %s 已更新" % lang)
    print("共替换 %d 处" % total)


if __name__ == "__main__":
    main()
