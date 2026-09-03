# -*- coding: utf-8 -*-
"""
修正 admin 命名空间的 2 个结构问题 + 补 2 个缺失键：

1. admin.tier  应为对象 { public, free, paid }     （代码用 a.tier?.[r.access_tier]）
2. admin.status 应为对象 { new, reviewing, matched, closed }（代码用 a.status?.[r.status]）
   之前写成了字符串，导致 TS7015「index expression is not of type number」
3. 补 admin.empty（列表空态）
4. 补 admin.editorNote（供应商编辑页底部说明）

铁律：io.open 读写两端 newline=""，写完核对 CRLF。
"""
import io
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT_DIR = os.path.join(ROOT, "i18n", "dictionaries")
LOCALES = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"]

TIER = {
    "en": {"public": "Public", "free": "Free", "paid": "Paid"},
    "zh": {"public": "公开", "free": "免费用户", "paid": "付费会员"},
    "zh-TW": {"public": "公開", "free": "免費用戶", "paid": "付費會員"},
    "es": {"public": "Público", "free": "Gratis", "paid": "De pago"},
    "de": {"public": "Öffentlich", "free": "Kostenlos", "paid": "Kostenpflichtig"},
    "fr": {"public": "Public", "free": "Gratuit", "paid": "Payant"},
    "pt": {"public": "Público", "free": "Gratuito", "paid": "Pago"},
    "ja": {"public": "公開", "free": "無料", "paid": "有料"},
    "ar": {"public": "عام", "free": "مجاني", "paid": "مدفوع"},
}

STATUS = {
    "en": {"new": "New", "reviewing": "Reviewing", "matched": "Matched", "closed": "Closed"},
    "zh": {"new": "新提交", "reviewing": "处理中", "matched": "已匹配", "closed": "已关闭"},
    "zh-TW": {"new": "新提交", "reviewing": "處理中", "matched": "已配對", "closed": "已關閉"},
    "es": {"new": "Nueva", "reviewing": "En revisión", "matched": "Emparejada", "closed": "Cerrada"},
    "de": {"new": "Neu", "reviewing": "In Prüfung", "matched": "Zugeordnet", "closed": "Geschlossen"},
    "fr": {"new": "Nouvelle", "reviewing": "En cours d'examen", "matched": "Rapprochée", "closed": "Clôturée"},
    "pt": {"new": "Nova", "reviewing": "Em análise", "matched": "Correspondida", "closed": "Encerrada"},
    "ja": {"new": "新規", "reviewing": "対応中", "matched": "マッチング済み", "closed": "完了"},
    "ar": {"new": "جديدة", "reviewing": "قيد المراجعة", "matched": "تمت المطابقة", "closed": "مغلقة"},
}

EMPTY = {
    "en": "No records yet.",
    "zh": "暂无记录。",
    "zh-TW": "暫無記錄。",
    "es": "Aún no hay registros.",
    "de": "Noch keine Einträge.",
    "fr": "Aucun enregistrement pour l'instant.",
    "pt": "Ainda não há registros.",
    "ja": "まだ記録はありません。",
    "ar": "لا توجد سجلات بعد.",
}

EDITOR_NOTE = {
    "en": "Changes go live immediately. Public fields stay visible to everyone and are indexed by search engines, so keep them accurate.",
    "zh": "修改立即生效。公开字段对所有人可见且会被搜索引擎收录，请确保内容准确。",
    "zh-TW": "修改立即生效。公開欄位對所有人可見且會被搜尋引擎收錄，請確保內容正確。",
    "es": "Los cambios se publican al instante. Los campos públicos son visibles para todos y los indexan los buscadores, así que manténgalos exactos.",
    "de": "Änderungen werden sofort wirksam. Öffentliche Felder sind für alle sichtbar und werden von Suchmaschinen indexiert – halten Sie sie korrekt.",
    "fr": "Les modifications sont publiées immédiatement. Les champs publics restent visibles par tous et sont indexés par les moteurs de recherche : gardez-les exacts.",
    "pt": "As alterações entram no ar imediatamente. Os campos públicos ficam visíveis para todos e são indexados pelos buscadores, portanto mantenha-os corretos.",
    "ja": "変更はすぐに反映されます。公開フィールドは全員に表示され検索エンジンにも登録されるため、正確な内容を保ってください。",
    "ar": "تُنشر التغييرات فورًا. تبقى الحقول العامة مرئية للجميع ويتم فهرستها في محركات البحث، لذا حافظ على دقتها.",
}


def main() -> int:
    for loc in LOCALES:
        path = os.path.join(DICT_DIR, f"{loc}.json")
        raw_before = io.open(path, "rb").read()
        crlf_before = raw_before.count(b"\r\n")

        with io.open(path, "r", encoding="utf-8", newline="") as f:
            data = json.loads(f.read())

        a = data.get("admin")
        if not isinstance(a, dict):
            print(f"  {loc}: 无 admin 块，跳过")
            continue

        a["tier"] = TIER[loc]
        a["status"] = STATUS[loc]
        a["empty"] = EMPTY[loc]
        a["editorNote"] = EDITOR_NOTE[loc]

        out = json.dumps(data, ensure_ascii=False, indent=2)
        out_crlf = out.replace("\r\n", "\n").replace("\n", "\r\n") + "\r\n"
        with io.open(path, "w", encoding="utf-8", newline="") as f:
            f.write(out_crlf)

        raw_after = io.open(path, "rb").read()
        print(f"  {loc}: tier/status 转对象 + 补 empty/editorNote | CRLF {crlf_before} -> {raw_after.count(chr(13).encode() + chr(10).encode())}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
