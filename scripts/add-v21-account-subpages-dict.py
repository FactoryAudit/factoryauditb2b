# -*- coding: utf-8 -*-
"""
为 V2.1 账号子页（/account/saved、/account/rfqs）补齐 9 语字典键。

铁律：
  1. Python 读写两端都加 newline="" —— 否则 CRLF 会被改成 LF，整份字典 diff 爆炸
  2. 改完核对 raw.count(b'\r\n') 与改前一致
  3. 新键插在 account 对象的 "panel" 之后，保持既有键顺序不变
  4. 已存在同名键则跳过（幂等，可重复执行）
"""
import io
import json
import os
import sys
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT_DIR = os.path.join(ROOT, "i18n", "dictionaries")
BACKUP_DIR = os.path.join(ROOT, ".workbuddy", "dict-backup-before-account-subpages")

# 9 语新增键：插在 account.panel 之后
NEW_KEYS = {
    "en": {
        "navOverview": "Overview",
        "navSaved": "Saved suppliers",
        "navRfqs": "My RFQs",
        "loading": "Loading…",
        "listError": "Could not load this list. Please refresh the page.",
        "signInTitle": "Sign in to continue",
        "signInLead": "Sign in to see your saved suppliers and RFQs.",
        "savedTitle": "Saved suppliers",
        "savedLead": "Suppliers you saved for later.",
        "savedEmpty": "You have not saved any suppliers yet.",
        "savedEmptyCta": "Browse the supplier directory",
        "remove": "Remove",
        "rfqsTitle": "My RFQs",
        "rfqsLead": "Requests you submitted and their current status.",
        "rfqsEmpty": "You have not submitted any RFQ yet.",
        "rfqsEmptyCta": "Submit an RFQ",
    },
    "zh": {
        "navOverview": "概览",
        "navSaved": "收藏的供应商",
        "navRfqs": "我的询价",
        "loading": "载入中…",
        "listError": "无法载入这个列表，请刷新页面重试。",
        "signInTitle": "登录后继续",
        "signInLead": "登录后查看你收藏的供应商和询价单。",
        "savedTitle": "收藏的供应商",
        "savedLead": "你收藏以备后查的供应商。",
        "savedEmpty": "你还没有收藏任何供应商。",
        "savedEmptyCta": "浏览供应商目录",
        "remove": "移除",
        "rfqsTitle": "我的询价",
        "rfqsLead": "你提交的询价单及其当前状态。",
        "rfqsEmpty": "你还没有提交任何询价。",
        "rfqsEmptyCta": "提交询价",
    },
    "zh-TW": {
        "navOverview": "概覽",
        "navSaved": "收藏的供應商",
        "navRfqs": "我的詢價",
        "loading": "載入中…",
        "listError": "無法載入這個清單，請重新整理頁面再試一次。",
        "signInTitle": "登入後繼續",
        "signInLead": "登入後可查看你收藏的供應商與詢價單。",
        "savedTitle": "收藏的供應商",
        "savedLead": "你收藏以備日後查閱的供應商。",
        "savedEmpty": "你還沒有收藏任何供應商。",
        "savedEmptyCta": "瀏覽供應商目錄",
        "remove": "移除",
        "rfqsTitle": "我的詢價",
        "rfqsLead": "你提交的詢價單及其目前狀態。",
        "rfqsEmpty": "你還沒有提交任何詢價。",
        "rfqsEmptyCta": "提交詢價",
    },
    "es": {
        "navOverview": "Resumen",
        "navSaved": "Proveedores guardados",
        "navRfqs": "Mis solicitudes",
        "loading": "Cargando…",
        "listError": "No se pudo cargar esta lista. Actualiza la página.",
        "signInTitle": "Inicia sesión para continuar",
        "signInLead": "Inicia sesión para ver tus proveedores guardados y solicitudes.",
        "savedTitle": "Proveedores guardados",
        "savedLead": "Proveedores que guardaste para más tarde.",
        "savedEmpty": "Todavía no has guardado ningún proveedor.",
        "savedEmptyCta": "Explorar el directorio de proveedores",
        "remove": "Quitar",
        "rfqsTitle": "Mis solicitudes",
        "rfqsLead": "Solicitudes que enviaste y su estado actual.",
        "rfqsEmpty": "Todavía no has enviado ninguna solicitud.",
        "rfqsEmptyCta": "Enviar una solicitud",
    },
    "de": {
        "navOverview": "Übersicht",
        "navSaved": "Gespeicherte Lieferanten",
        "navRfqs": "Meine Anfragen",
        "loading": "Wird geladen…",
        "listError": "Diese Liste konnte nicht geladen werden. Bitte Seite neu laden.",
        "signInTitle": "Anmelden, um fortzufahren",
        "signInLead": "Melde dich an, um deine gespeicherten Lieferanten und Anfragen zu sehen.",
        "savedTitle": "Gespeicherte Lieferanten",
        "savedLead": "Lieferanten, die du für später gespeichert hast.",
        "savedEmpty": "Du hast noch keine Lieferanten gespeichert.",
        "savedEmptyCta": "Lieferantenverzeichnis durchsuchen",
        "remove": "Entfernen",
        "rfqsTitle": "Meine Anfragen",
        "rfqsLead": "Von dir gesendete Anfragen und ihr aktueller Status.",
        "rfqsEmpty": "Du hast noch keine Anfrage gesendet.",
        "rfqsEmptyCta": "Anfrage senden",
    },
    "fr": {
        "navOverview": "Vue d’ensemble",
        "navSaved": "Fournisseurs enregistrés",
        "navRfqs": "Mes demandes",
        "loading": "Chargement…",
        "listError": "Impossible de charger cette liste. Actualisez la page.",
        "signInTitle": "Connectez-vous pour continuer",
        "signInLead": "Connectez-vous pour voir vos fournisseurs enregistrés et vos demandes.",
        "savedTitle": "Fournisseurs enregistrés",
        "savedLead": "Fournisseurs que vous avez enregistrés pour plus tard.",
        "savedEmpty": "Vous n’avez encore enregistré aucun fournisseur.",
        "savedEmptyCta": "Parcourir l’annuaire des fournisseurs",
        "remove": "Retirer",
        "rfqsTitle": "Mes demandes",
        "rfqsLead": "Demandes que vous avez envoyées et leur statut actuel.",
        "rfqsEmpty": "Vous n’avez encore envoyé aucune demande.",
        "rfqsEmptyCta": "Envoyer une demande",
    },
    "pt": {
        "navOverview": "Visão geral",
        "navSaved": "Fornecedores salvos",
        "navRfqs": "Minhas solicitações",
        "loading": "Carregando…",
        "listError": "Não foi possível carregar esta lista. Atualize a página.",
        "signInTitle": "Entre para continuar",
        "signInLead": "Entre para ver seus fornecedores salvos e solicitações.",
        "savedTitle": "Fornecedores salvos",
        "savedLead": "Fornecedores que você salvou para depois.",
        "savedEmpty": "Você ainda não salvou nenhum fornecedor.",
        "savedEmptyCta": "Explorar o diretório de fornecedores",
        "remove": "Remover",
        "rfqsTitle": "Minhas solicitações",
        "rfqsLead": "Solicitações que você enviou e o status atual de cada uma.",
        "rfqsEmpty": "Você ainda não enviou nenhuma solicitação.",
        "rfqsEmptyCta": "Enviar uma solicitação",
    },
    "ja": {
        "navOverview": "概要",
        "navSaved": "保存したサプライヤー",
        "navRfqs": "マイ RFQ",
        "loading": "読み込み中…",
        "listError": "この一覧を読み込めませんでした。ページを再読み込みしてください。",
        "signInTitle": "続けるにはログインしてください",
        "signInLead": "ログインすると、保存したサプライヤーと RFQ を確認できます。",
        "savedTitle": "保存したサプライヤー",
        "savedLead": "後で見るために保存したサプライヤーです。",
        "savedEmpty": "まだサプライヤーを保存していません。",
        "savedEmptyCta": "サプライヤーディレクトリを見る",
        "remove": "削除",
        "rfqsTitle": "マイ RFQ",
        "rfqsLead": "送信した RFQ とその現在のステータスです。",
        "rfqsEmpty": "まだ RFQ を送信していません。",
        "rfqsEmptyCta": "RFQ を送信する",
    },
    "ar": {
        "navOverview": "نظرة عامة",
        "navSaved": "الموردون المحفوظون",
        "navRfqs": "طلبات عروض الأسعار",
        "loading": "جارٍ التحميل…",
        "listError": "تعذّر تحميل هذه القائمة. يُرجى تحديث الصفحة.",
        "signInTitle": "سجّل الدخول للمتابعة",
        "signInLead": "سجّل الدخول لعرض الموردين المحفوظين وطلبات عروض الأسعار.",
        "savedTitle": "الموردون المحفوظون",
        "savedLead": "الموردون الذين حفظتهم للرجوع إليهم لاحقًا.",
        "savedEmpty": "لم تحفظ أي مورد بعد.",
        "savedEmptyCta": "تصفّح دليل الموردين",
        "remove": "إزالة",
        "rfqsTitle": "طلبات عروض الأسعار",
        "rfqsLead": "الطلبات التي أرسلتها وحالتها الحالية.",
        "rfqsEmpty": "لم ترسل أي طلب عرض سعر بعد.",
        "rfqsEmptyCta": "إرسال طلب عرض سعر",
    },
}

LOCALES = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"]


def main() -> int:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    changed = 0

    for loc in LOCALES:
        path = os.path.join(DICT_DIR, f"{loc}.json")
        if not os.path.exists(path):
            print(f"[skip] {loc}.json not found")
            continue

        # ---- 读（newline="" 保住 CRLF）----
        with io.open(path, "r", encoding="utf-8", newline="") as f:
            raw = f.read()
        crlf_before = raw.count("\r\n")
        data = json.loads(raw, object_pairs_hook=OrderedDict)

        account = data.get("account")
        if not isinstance(account, dict):
            print(f"[skip] {loc}: no account namespace")
            continue

        additions = NEW_KEYS.get(loc, {})
        added = 0
        rebuilt = OrderedDict()
        for k, v in account.items():
            rebuilt[k] = v
            # 插在 panel 之后
            if k == "panel":
                for nk, nv in additions.items():
                    if nk not in account:
                        rebuilt[nk] = nv
                        added += 1
        # 没有 panel（理论上不会）则追加到末尾
        if "panel" not in account:
            for nk, nv in additions.items():
                if nk not in account:
                    rebuilt[nk] = nv
                    added += 1

        if added == 0:
            print(f"[ok]   {loc}: already up to date")
            continue

        data["account"] = rebuilt

        # ---- 备份 ----
        backup_path = os.path.join(BACKUP_DIR, f"{loc}.json")
        if not os.path.exists(backup_path):
            with io.open(backup_path, "w", encoding="utf-8", newline="") as f:
                f.write(raw)

        # ---- 写（newline="" + 保持 CRLF）----
        out = json.dumps(data, ensure_ascii=False, indent=2)
        if crlf_before > 0:
            out = out.replace("\n", "\r\n")
        with io.open(path, "w", encoding="utf-8", newline="") as f:
            f.write(out)

        # ---- 校验 ----
        # 正确的判据不是"CRLF 总数不变"（新增键必然增加行数），
        # 而是"没有裸 LF"：所有换行都必须是 CRLF，否则 Git 会显示整文件 diff。
        with io.open(path, "rb") as f:
            raw_after = f.read()
        crlf_after = raw_after.count(b"\r\n")
        lf_total = raw_after.count(b"\n")
        bare_lf = lf_total - crlf_after
        ok = bare_lf == 0
        print(
            f"[done] {loc}: +{added} keys | CRLF {crlf_before} -> {crlf_after} "
            f"| bare LF = {bare_lf} {'OK' if ok else '!! MISMATCH !!'}"
        )
        if not ok:
            return 1
        changed += 1

    print(f"\n=== changed {changed} dictionaries ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
