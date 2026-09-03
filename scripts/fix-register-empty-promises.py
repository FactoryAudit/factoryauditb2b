#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修正 /register 页与 notifyBuyerRegisterReceived 邮件中的空承诺（2026-09-03）。

V2.0 无登录系统，邮件 + 注册页文案却写「手动建号 + 发登录信息」，
与代码事实不符。改成与其他表单一致的诚实文案：
  「收到请求 → 人工审核 → 一个工作日内回复」

同时去掉「View 5 supplier profiles per month / saved suppliers / verification
status alerts」等 V2.0 没有的功能承诺，把权益项改为真实可用的能力。

用法：
  python scripts/fix-register-empty-promises.py
"""
import io
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DICT_DIR = ROOT / "i18n" / "dictionaries"
BACKUP_DIR = ROOT / ".workbuddy" / "dict-backup-before-register-empty-promises"

# 关键键锚定替换（避免旧值是别的文案子串时误伤；用键名 + 旧值定位）
KEY_FIXES = {
    "register.metaTitle": "Create a Free Account",
    "register.metaDesc": "Create a free account to view 5 supplier profiles per month, save and compare the suppliers you are evaluating.",
    "register.h1": "Create a free account",
    "register.lead": "No credit card required. View 5 supplier profiles per month and save the suppliers you are evaluating.",
    "register.nextLead": "After you submit, our team creates your account manually and emails your sign-in details within one business day.",
    "register.form.successLead": "We will email your sign-in details within one business day.",
}

# 数组型（benefits 整组替换）— 旧值按位置匹配
OLD_BENEFITS = [
    "View {n} supplier profiles per month",
    "Save suppliers you are evaluating",
    "Compare up to 3 suppliers side by side",
    "Verification status update alerts",
    "Upgrade to Founding Buyer anytime",
]
NEW_BENEFITS = [
    "Browse the full supplier directory",
    "Compare up to {n} suppliers side by side",   # SupplierComparison MAX_SUPPLIERS = 5
    "Run free risk calculators and verification checklists",
    "Request sample reports and audit quotes from our team",
    "Optional Founding Buyer membership for priority direct contact",
]

# 替换表：英 → 各语言（保留 {n} 占位符）
LEAD = "No credit card. Request access and our team will reply within one business day."
LEAD_I18N = {
    "zh": "无需信用卡。提交申请后团队将在一个工作日内回复。",
    "zh-TW": "無需信用卡。提交申請後團隊將在一個工作日內回覆。",
    "es": "Sin tarjeta de crédito. Envía tu solicitud y nuestro equipo responderá en un día hábil.",
    "de": "Keine Kreditkarte nötig. Anfrage absenden — unser Team antwortet innerhalb eines Werktags.",
    "fr": "Sans carte bancaire. Envoyez votre demande et notre équipe répondra sous un jour ouvré.",
    "pt": "Sem cartão de crédito. Envie sua solicitação e nossa equipe responderá em um dia útil.",
    "ja": "クレジットカード不要。申請送信後、弊チームが遅くとも翌営業日までにご返信します。",
    "ar": "بدون بطاقة ائتمان. أرسل طلبك وسيرد فريقنا خلال يوم عمل واحد.",
}

H1_I18N = {
    "en": "Request Supplier Intelligence Access",
    "zh": "申请供应商情报目录",
    "zh-TW": "申請供應商情報目錄",
    "es": "Solicitar acceso al directorio de inteligencia de proveedores",
    "de": "Zugang zum Lieferanten-Verzeichnis anfragen",
    "fr": "Demander l'accès au répertoire fournisseurs",
    "pt": "Solicitar acesso ao diretório de inteligência de fornecedores",
    "ja": "サプライヤー情報ディレクトリへのアクセス申請",
    "ar": "طلب الوصول إلى دليل معلومات الموردين",
}

META_TITLE_I18N = {
    "en": "Request Supplier Intelligence Access",
    "zh": "申请供应商情报目录 | FactoryAuditB2B",
    "zh-TW": "申請供應商情報目錄 | FactoryAuditB2B",
    "es": "Solicitar acceso al directorio | FactoryAuditB2B",
    "de": "Zugang anfragen | FactoryAuditB2B",
    "fr": "Demander l'accès | FactoryAuditB2B",
    "pt": "Solicitar acesso | FactoryAuditB2B",
    "ja": "サプライヤー情報ディレクトリ申請 | FactoryAuditB2B",
    "ar": "طلب الوصول إلى الدليل | FactoryAuditB2B",
}

META_DESC_I18N = {
    "en": "Request access to FactoryAuditB2B's supplier directory. Our team reviews manually and replies within one business day.",
    "zh": "申请访问 FactoryAuditB2B 的供应商情报目录。团队人工审核，一个工作日内回复。",
    "zh-TW": "申請存取 FactoryAuditB2B 的供應商情報目錄。團隊人工審核，一個工作日內回覆。",
    "es": "Solicita acceso al directorio de proveedores de FactoryAuditB2B. Nuestro equipo revisa manualmente y responde en un día hábil.",
    "de": "Fordern Sie Zugang zum FactoryAuditB2B-Lieferantenverzeichnis an. Unser Team prüft manuell und antwortet innerhalb eines Werktags.",
    "fr": "Demandez l'accès au répertoire fournisseurs FactoryAuditB2B. Notre équipe examine manuellement et répond sous un jour ouvré.",
    "pt": "Solicite acesso ao diretório de fornecedores da FactoryAuditB2B. Nossa equipe revisa manualmente e responde em um dia útil.",
    "ja": "FactoryAuditB2B のサプライヤー情報ディレクトリへのアクセスを申請。弊チームが翌営業日までに返信。",
    "ar": "اطلب الوصول إلى دليل موردي FactoryAuditB2B. فريقنا يراجع يدوياً ويرد خلال يوم عمل.",
}

NEXT_LEAD_I18N = {
    "en": "After you submit, our team reviews your request manually and replies within one business day.",
    "zh": "提交后，团队人工审核申请并在一个工作日内回复。",
    "zh-TW": "提交後，團隊人工審核申請並在一個工作日內回覆。",
    "es": "Después de enviar, nuestro equipo revisa la solicitud manualmente y responde en un día hábil.",
    "de": "Nach dem Absenden prüft unser Team Ihre Anfrage manuell und antwortet innerhalb eines Werktags.",
    "fr": "Après envoi, notre équipe examine votre demande manuellement et répond sous un jour ouvré.",
    "pt": "Após o envio, nossa equipe revisa a solicitação manualmente e responde em um dia útil.",
    "ja": "送信後、弊チームがリクエストを手動で確認し、翌営業日までにご返信します。",
    "ar": "بعد الإرسال، يراجع فريقنا طلبك يدوياً ويرد خلال يوم عمل.",
}

SUCCESS_LEAD_I18N = {
    "en": "Our team will reply to your email within one business day.",
    "zh": "团队会在一个工作日内通过邮件回复您。",
    "zh-TW": "團隊會在一個工作日內透過電子郵件回覆您。",
    "es": "Nuestro equipo responderá a tu correo en un día hábil.",
    "de": "Unser Team antwortet Ihnen innerhalb eines Werktags per E-Mail.",
    "fr": "Notre équipe répondra à votre e-mail sous un jour ouvré.",
    "pt": "Nossa equipe responderá ao seu e-mail em um dia útil.",
    "ja": "弊チームが翌営業日までにご返信いたします。",
    "ar": "سيرد فريقنا على بريدك الإلكتروني خلال يوم عمل واحد.",
}

BENEFITS_I18N = {
    "en": NEW_BENEFITS,
    "zh": [
        "浏览全部供应商情报目录",
        "并排对比多达 {n} 家供应商",
        "使用免费的风险计算器与核查清单",
        "向团队申请样例报告与验厂报价",
            "可选付费 Founding Buyer 会员获得优先直接对接",
    ],
    "zh-TW": [
        "瀏覽全部供應商情報目錄",
        "並排比較最多 {n} 家供應商",
        "使用免費的風險計算器與核驗清板",
        "向團隊申請樣本報告與驗廠報價",
        "可選付費 Founding Buyer 會員獲得優先直接對接",
    ],
    "es": [
        "Explora el directorio completo de proveedores",
        "Compara hasta {n} proveedores en paralelo",
        "Usa calculadoras de riesgo y listas de verificación gratuitas",
        "Solicita reportes de muestra y cotizaciones de auditoría",
        "Membresía Founding Buyer opcional con contacto directo prioritario",
    ],
    "de": [
        "Vollständiges Lieferantenverzeichnis durchsuchen",
        "Bis zu {n} Lieferanten nebeneinander vergleichen",
        "Kostenlose Risikorechner und Prüfchecklisten nutzen",
        "Musterberichte und Audit-Angebote vom Team anfordern",
        "Optionale Founding-Buyer-Mitgliedschaft für priorisierten Direktkontakt",
    ],
    "fr": [
        "Parcourez le répertoire complet des fournisseurs",
        "Comparez jusqu'à {n} fournisseurs côte à côte",
        "Utilisez les calculateurs de risque et listes de vérification gratuits",
        "Demandez des rapports d'exemple et devis d'audit à notre équipe",
        "Adhésion Founding Buyer en option pour un contact direct prioritaire",
    ],
    "pt": [
        "Navegue pelo diretório completo de fornecedores",
        "Compare até {n} fornecedores lado a lado",
        "Use calculadoras de risco e listas de verificação gratuitas",
        "Solicite relatórios de amostra e orçamentos de auditoria à nossa equipe",
        "Adesão Founding Buyer opcional para contato direto prioritário",
    ],
    "ja": [
        "サプライヤー情報ディレクトリを全て閲覧",
        "最大 {n} 社まで並列比較",
        "無料のリスク計算器・チェックリストを利用",
        "サンプルレポート・監査見積を弊チームへ依頼",
        "任意で Founding Buyer 会員（優先直接対応）に加入",
    ],
    "ar": [
        "تصفح دليل الموردين بالكامل",
        "قارن حتى {n} من الموردين جنباً إلى جنب",
        "استخدم حاسبات المخاطر وقوائم التحقق المجانية",
        "اطلب تقارير عينة وعروض تدقيق من فريقنا",
        "عضوية Founding Buyer اختيارية للتواصل المباشر ذو الأولوية",
    ],
}


def load_json(path: Path) -> tuple:
    raw = path.read_bytes()
    # 保留换行符：读为 bytes，避免 Python 改写 CRLF
    text = raw.decode("utf-8")
    return json.loads(text), raw


def save_json(path: Path, data, original_bytes: bytes):
    """保留原文件换行符风格（CRLF / LF）"""
    out = json.dumps(data, ensure_ascii=False, indent=2)
    if b"\r\n" in original_bytes and b"\r\n" not in out.encode("utf-8"):
        # 原 CRLF → 输出也 CRLF
        out = out.replace("\n", "\r\n")
    path.write_bytes(out.encode("utf-8"))


def replace_key(d: dict, key_path: str, new_val, lang: str) -> bool:
    """严格键路径替换（只允许完全等于旧值才改，避免误伤）"""
    parts = key_path.split(".")
    obj = d
    for p in parts[:-1]:
        if p not in obj:
            return False
        obj = obj[p]
    last = parts[-1]
    if last not in obj:
        return False
    if obj[last] != new_val:  # 只有当前值等于预设旧值时才改（防回滚或跑两次）
        # 但用户语言有自己的值——所以"new_val"在脚本里指"目标新值"，
        # 实际判断是：当前值是 OLD 才能改
        # 这里改为直接覆盖（脚本重跑时应已被覆盖或为旧值）
        pass
    obj[last] = new_val
    return True


def replace_benefits(d: dict, lang: str) -> int:
    if "register" not in d or "benefits" not in d["register"]:
        return 0
    arr = d["register"]["benefits"]
    if not isinstance(arr, list) or len(arr) != len(OLD_BENEFITS):
        return 0
    target = BENEFITS_I18N.get(lang, BENEFITS_I18N["en"])
    changed = 0
    # 用 OLD_BENEFITS[i] 匹配英文旧版；其他语言用 i 位置替换并检查已是目标值
    for i in range(len(arr)):
        if lang == "en":
            if arr[i] == OLD_BENEFITS[i] and arr[i] != target[i]:
                arr[i] = target[i]
                changed += 1
        else:
            # 非英文：原 benefits 是各语言自己的旧翻译（不是英文），
            # 不能用 OLD_BENEFITS[i] 匹配。直接按 i 位置覆盖；
            # 若已是目标则跳过（脚本可重跑）。
            if arr[i] != target[i]:
                arr[i] = target[i]
                changed += 1
    return changed


def process_file(path: Path, lang: str) -> tuple:
    data, raw = load_json(path)
    if "register" not in data:
        return 0, 0
    changes = 0

    # metaTitle
    new_val = META_TITLE_I18N.get(lang, META_TITLE_I18N["en"])
    if data["register"].get("metaTitle") != new_val:
        data["register"]["metaTitle"] = new_val
        changes += 1

    # metaDesc
    new_val = META_DESC_I18N.get(lang, META_DESC_I18N["en"])
    if data["register"].get("metaDesc") != new_val:
        data["register"]["metaDesc"] = new_val
        changes += 1

    # h1
    new_val = H1_I18N.get(lang, H1_I18N["en"])
    if data["register"].get("h1") != new_val:
        data["register"]["h1"] = new_val
        changes += 1

    # lead
    new_val = LEAD_I18N.get(lang, LEAD)
    if data["register"].get("lead") != new_val:
        data["register"]["lead"] = new_val
        changes += 1

    # nextLead
    new_val = NEXT_LEAD_I18N.get(lang, NEXT_LEAD_I18N["en"])
    if data["register"].get("nextLead") != new_val:
        data["register"]["nextLead"] = new_val
        changes += 1

    # form.successLead
    new_val = SUCCESS_LEAD_I18N.get(lang, SUCCESS_LEAD_I18N["en"])
    if "form" in data["register"] and data["register"]["form"].get("successLead") != new_val:
        data["register"]["form"]["successLead"] = new_val
        changes += 1

    # benefits
    changes += replace_benefits(data, lang)

    save_json(path, data, raw)
    return changes, len(OLD_BENEFITS)


def main():
    # 备份
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    for p in DICT_DIR.glob("*.json"):
        backup = BACKUP_DIR / p.name
        backup.write_bytes(p.read_bytes())

    total_changes = 0
    summary = []
    for p in sorted(DICT_DIR.glob("*.json")):
        lang = p.stem
        changes, benefit_count = process_file(p, lang)
        total_changes += changes
        summary.append((lang, changes))
        print(f"{lang}: {changes} changes ({benefit_count} benefit items expected)")
    print(f"\n总计: {total_changes} 处改动")
    print(f"备份: {BACKUP_DIR}")

    # CRLF 校验（铁律）
    for p in DICT_DIR.glob("*.json"):
        b = p.read_bytes()
        crlf = b.count(b"\r\n")
        if crlf == 0:
            print(f"⚠️  {p.name}: 无 LF 标记，请核对换行符")


if __name__ == "__main__":
    main()