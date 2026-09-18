# -*- coding: utf-8 -*-
"""
CS-16 admin 字典补齐：为 9 份字典的 admin 命名空间新增 Supplier Management V1 所需的键。

铁律（沿用 add-v21-admin-dict.py）：
  - io.open 读写两端都要 newline=""，写回时把 \n 统一替换成 \r\n。
  - 只补缺失键（不覆盖已有翻译），缺失时按各语块兜底。
  - 保证 en 叶子数与其他 8 语一致（cs06a C8 / cs05c G4-G5 断言）。
"""
import io
import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT_DIR = os.path.join(ROOT, "i18n", "dictionaries")
BACKUP_DIR = os.path.join(ROOT, ".workbuddy", "dict-backup-before-cs16-admin")

LOCALES = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"]

# 32 个新键（en 基准）。顺序与英文一致。
NEW = {
    "en": {
        "fieldEnglishName": "English name",
        "fieldCompanyType": "Company type",
        "fieldRegistrationNumber": "Registration number",
        "fieldWebsite": "Website",
        "fieldCountry": "Country",
        "fieldProvince": "Province / State",
        "fieldAddress": "Address",
        "fieldProducts": "Products",
        "fieldExportMarkets": "Export markets",
        "fieldContactPerson": "Contact person",
        "fieldContactEmail": "Contact email",
        "fieldPhone": "Phone",
        "fieldWhatsapp": "WhatsApp",
        "fieldCompanyDescription": "Company description",
        "colAuthorized": "Authorized",
        "colCreatedAt": "Created",
        "colUpdatedAt": "Updated",
        "filterAll": "All",
        "filterUnpublished": "Unpublished",
        "filterNotAuthorized": "Not authorized",
        "searchPlaceholder": "Search name, email or website",
        "authorizedTitle": "Authorization",
        "authorizedBy": "Authorized by",
        "authorizedAt": "Authorized at",
        "consentVersion": "Consent version",
        "consentAt": "Consent date",
        "consentIp": "IP address",
        "consentUserAgent": "User agent",
        "consentHistoryNote": "Consent records are historical and cannot be changed.",
        "publishButton": "Publish",
        "unpublishButton": "Unpublish",
        "publishBlocked": "Cannot publish: supplier has not authorized their profile.",
    },
    "zh": {
        "fieldEnglishName": "英文名",
        "fieldCompanyType": "公司类型",
        "fieldRegistrationNumber": "注册号",
        "fieldWebsite": "官网",
        "fieldCountry": "国家",
        "fieldProvince": "省/州",
        "fieldAddress": "地址",
        "fieldProducts": "产品",
        "fieldExportMarkets": "出口市场",
        "fieldContactPerson": "联系人",
        "fieldContactEmail": "联系邮箱",
        "fieldPhone": "电话",
        "fieldWhatsapp": "WhatsApp",
        "fieldCompanyDescription": "公司简介",
        "colAuthorized": "已授权",
        "colCreatedAt": "创建时间",
        "colUpdatedAt": "更新时间",
        "filterAll": "全部",
        "filterUnpublished": "未发布",
        "filterNotAuthorized": "未授权",
        "searchPlaceholder": "搜索名称、邮箱或官网",
        "authorizedTitle": "授权",
        "authorizedBy": "授权人",
        "authorizedAt": "授权时间",
        "consentVersion": "同意条款版本",
        "consentAt": "同意日期",
        "consentIp": "IP 地址",
        "consentUserAgent": "用户代理",
        "consentHistoryNote": "同意记录为历史留痕，不可修改。",
        "publishButton": "发布",
        "unpublishButton": "下架",
        "publishBlocked": "无法发布：该供应商未授权公开其档案。",
    },
    "zh-TW": {
        "fieldEnglishName": "英文名稱",
        "fieldCompanyType": "公司類型",
        "fieldRegistrationNumber": "註冊號",
        "fieldWebsite": "官網",
        "fieldCountry": "國家",
        "fieldProvince": "省/州",
        "fieldAddress": "地址",
        "fieldProducts": "產品",
        "fieldExportMarkets": "出口市場",
        "fieldContactPerson": "聯絡人",
        "fieldContactEmail": "聯絡信箱",
        "fieldPhone": "電話",
        "fieldWhatsapp": "WhatsApp",
        "fieldCompanyDescription": "公司簡介",
        "colAuthorized": "已授權",
        "colCreatedAt": "建立時間",
        "colUpdatedAt": "更新時間",
        "filterAll": "全部",
        "filterUnpublished": "未發布",
        "filterNotAuthorized": "未授權",
        "searchPlaceholder": "搜尋名稱、信箱或官網",
        "authorizedTitle": "授權",
        "authorizedBy": "授權人",
        "authorizedAt": "授權時間",
        "consentVersion": "同意條款版本",
        "consentAt": "同意日期",
        "consentIp": "IP 位址",
        "consentUserAgent": "使用者代理",
        "consentHistoryNote": "同意記錄為歷史留痕，不可修改。",
        "publishButton": "發布",
        "unpublishButton": "下架",
        "publishBlocked": "無法發布：該供應商未授權公開其檔案。",
    },
    "es": {
        "fieldEnglishName": "Nombre en inglés",
        "fieldCompanyType": "Tipo de empresa",
        "fieldRegistrationNumber": "Número de registro",
        "fieldWebsite": "Sitio web",
        "fieldCountry": "País",
        "fieldProvince": "Provincia / Estado",
        "fieldAddress": "Dirección",
        "fieldProducts": "Productos",
        "fieldExportMarkets": "Mercados de exportación",
        "fieldContactPerson": "Persona de contacto",
        "fieldContactEmail": "Correo de contacto",
        "fieldPhone": "Teléfono",
        "fieldWhatsapp": "WhatsApp",
        "fieldCompanyDescription": "Descripción de la empresa",
        "colAuthorized": "Autorizado",
        "colCreatedAt": "Creado",
        "colUpdatedAt": "Actualizado",
        "filterAll": "Todos",
        "filterUnpublished": "No publicado",
        "filterNotAuthorized": "No autorizado",
        "searchPlaceholder": "Buscar nombre, correo o sitio web",
        "authorizedTitle": "Autorización",
        "authorizedBy": "Autorizado por",
        "authorizedAt": "Autorizado el",
        "consentVersion": "Versión del consentimiento",
        "consentAt": "Fecha de consentimiento",
        "consentIp": "Dirección IP",
        "consentUserAgent": "Agente de usuario",
        "consentHistoryNote": "Los registros de consentimiento son históricos y no se pueden cambiar.",
        "publishButton": "Publicar",
        "unpublishButton": "Ocultar",
        "publishBlocked": "No se puede publicar: el proveedor no ha autorizado su perfil.",
    },
    "de": {
        "fieldEnglishName": "Englischer Name",
        "fieldCompanyType": "Unternehmenstyp",
        "fieldRegistrationNumber": "Registrierungsnummer",
        "fieldWebsite": "Website",
        "fieldCountry": "Land",
        "fieldProvince": "Bundesland / Staat",
        "fieldAddress": "Adresse",
        "fieldProducts": "Produkte",
        "fieldExportMarkets": "Exportmärkte",
        "fieldContactPerson": "Kontaktperson",
        "fieldContactEmail": "Kontakt-E-Mail",
        "fieldPhone": "Telefon",
        "fieldWhatsapp": "WhatsApp",
        "fieldCompanyDescription": "Unternehmensbeschreibung",
        "colAuthorized": "Autorisiert",
        "colCreatedAt": "Erstellt",
        "colUpdatedAt": "Aktualisiert",
        "filterAll": "Alle",
        "filterUnpublished": "Nicht veröffentlicht",
        "filterNotAuthorized": "Nicht autorisiert",
        "searchPlaceholder": "Name, E-Mail oder Website suchen",
        "authorizedTitle": "Autorisierung",
        "authorizedBy": "Autorisiert von",
        "authorizedAt": "Autorisiert am",
        "consentVersion": "Einwilligungsversion",
        "consentAt": "Einwilligungsdatum",
        "consentIp": "IP-Adresse",
        "consentUserAgent": "User-Agent",
        "consentHistoryNote": "Einwilligungsdatensätze sind historisch und können nicht geändert werden.",
        "publishButton": "Veröffentlichen",
        "unpublishButton": "Zurückziehen",
        "publishBlocked": "Veröffentlichung nicht möglich: Der Lieferant hat sein Profil nicht autorisiert.",
    },
    "fr": {
        "fieldEnglishName": "Nom anglais",
        "fieldCompanyType": "Type d'entreprise",
        "fieldRegistrationNumber": "Numéro d'enregistrement",
        "fieldWebsite": "Site web",
        "fieldCountry": "Pays",
        "fieldProvince": "Province / État",
        "fieldAddress": "Adresse",
        "fieldProducts": "Produits",
        "fieldExportMarkets": "Marchés d'exportation",
        "fieldContactPerson": "Personne à contacter",
        "fieldContactEmail": "E-mail de contact",
        "fieldPhone": "Téléphone",
        "fieldWhatsapp": "WhatsApp",
        "fieldCompanyDescription": "Description de l'entreprise",
        "colAuthorized": "Autorisé",
        "colCreatedAt": "Créé",
        "colUpdatedAt": "Mis à jour",
        "filterAll": "Tous",
        "filterUnpublished": "Non publié",
        "filterNotAuthorized": "Non autorisé",
        "searchPlaceholder": "Rechercher un nom, un e-mail ou un site web",
        "authorizedTitle": "Autorisation",
        "authorizedBy": "Autorisé par",
        "authorizedAt": "Autorisé le",
        "consentVersion": "Version du consentement",
        "consentAt": "Date de consentement",
        "consentIp": "Adresse IP",
        "consentUserAgent": "User-agent",
        "consentHistoryNote": "Les enregistrements de consentement sont historiques et ne peuvent pas être modifiés.",
        "publishButton": "Publier",
        "unpublishButton": "Dépublier",
        "publishBlocked": "Impossible de publier : le fournisseur n'a pas autorisé son profil.",
    },
    "pt": {
        "fieldEnglishName": "Nome em inglês",
        "fieldCompanyType": "Tipo de empresa",
        "fieldRegistrationNumber": "Número de registro",
        "fieldWebsite": "Site",
        "fieldCountry": "País",
        "fieldProvince": "Província / Estado",
        "fieldAddress": "Endereço",
        "fieldProducts": "Produtos",
        "fieldExportMarkets": "Mercados de exportação",
        "fieldContactPerson": "Pessoa de contato",
        "fieldContactEmail": "E-mail de contato",
        "fieldPhone": "Telefone",
        "fieldWhatsapp": "WhatsApp",
        "fieldCompanyDescription": "Descrição da empresa",
        "colAuthorized": "Autorizado",
        "colCreatedAt": "Criado",
        "colUpdatedAt": "Atualizado",
        "filterAll": "Todos",
        "filterUnpublished": "Não publicado",
        "filterNotAuthorized": "Não autorizado",
        "searchPlaceholder": "Buscar nome, e-mail ou site",
        "authorizedTitle": "Autorização",
        "authorizedBy": "Autorizado por",
        "authorizedAt": "Autorizado em",
        "consentVersion": "Versão do consentimento",
        "consentAt": "Data do consentimento",
        "consentIp": "Endereço IP",
        "consentUserAgent": "User-agent",
        "consentHistoryNote": "Os registros de consentimento são históricos e não podem ser alterados.",
        "publishButton": "Publicar",
        "unpublishButton": "Ocultar",
        "publishBlocked": "Não é possível publicar: o fornecedor não autorizou seu perfil.",
    },
    "ja": {
        "fieldEnglishName": "英語名",
        "fieldCompanyType": "企業タイプ",
        "fieldRegistrationNumber": "登録番号",
        "fieldWebsite": "ウェブサイト",
        "fieldCountry": "国",
        "fieldProvince": "州・省",
        "fieldAddress": "住所",
        "fieldProducts": "製品",
        "fieldExportMarkets": "輸出市場",
        "fieldContactPerson": "担当者",
        "fieldContactEmail": "連絡先メール",
        "fieldPhone": "電話",
        "fieldWhatsapp": "WhatsApp",
        "fieldCompanyDescription": "会社概要",
        "colAuthorized": "認可済み",
        "colCreatedAt": "作成日",
        "colUpdatedAt": "更新日",
        "filterAll": "すべて",
        "filterUnpublished": "未公開",
        "filterNotAuthorized": "未認可",
        "searchPlaceholder": "名前・メール・ウェブサイトで検索",
        "authorizedTitle": "認可",
        "authorizedBy": "認可者",
        "authorizedAt": "認可日",
        "consentVersion": "同意バージョン",
        "consentAt": "同意日",
        "consentIp": "IP アドレス",
        "consentUserAgent": "ユーザーエージェント",
        "consentHistoryNote": "同意記録は履歴として保存され、変更できません。",
        "publishButton": "公開する",
        "unpublishButton": "非公開にする",
        "publishBlocked": "公開できません：このサプライヤーはプロフィールの公開を認可していません。",
    },
    "ar": {
        "fieldEnglishName": "الاسم بالإنجليزية",
        "fieldCompanyType": "نوع الشركة",
        "fieldRegistrationNumber": "رقم التسجيل",
        "fieldWebsite": "الموقع الإلكتروني",
        "fieldCountry": "الدولة",
        "fieldProvince": "المقاطعة / الولاية",
        "fieldAddress": "العنوان",
        "fieldProducts": "المنتجات",
        "fieldExportMarkets": "أسواق التصدير",
        "fieldContactPerson": "شخص الاتصال",
        "fieldContactEmail": "البريد الإلكتروني للاتصال",
        "fieldPhone": "الهاتف",
        "fieldWhatsapp": "واتساب",
        "fieldCompanyDescription": "وصف الشركة",
        "colAuthorized": "مُصرّح",
        "colCreatedAt": "أنشئ في",
        "colUpdatedAt": "حُدّث في",
        "filterAll": "الكل",
        "filterUnpublished": "غير منشور",
        "filterNotAuthorized": "غير مصرّح",
        "searchPlaceholder": "ابحث بالاسم أو البريد أو الموقع",
        "authorizedTitle": "التصريح",
        "authorizedBy": "صرّح بواسطة",
        "authorizedAt": "صُرّح في",
        "consentVersion": "إصدار الموافقة",
        "consentAt": "تاريخ الموافقة",
        "consentIp": "عنوان IP",
        "consentUserAgent": "وكيل المستخدم",
        "consentHistoryNote": "سجلات الموافقة تاريخية ولا يمكن تغييرها.",
        "publishButton": "نشر",
        "unpublishButton": "إخفاء",
        "publishBlocked": "تعذّر النشر: المورّد لم يُصرّح بنشر ملفه.",
    },
}


def main() -> int:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    report = []
    for loc in LOCALES:
        path = os.path.join(DICT_DIR, f"{loc}.json")
        raw_before = io.open(path, "rb").read()
        crlf_before = raw_before.count(b"\r\n")
        shutil.copy2(path, os.path.join(BACKUP_DIR, f"{loc}.json"))

        with io.open(path, "r", encoding="utf-8", newline="") as f:
            text = f.read()
        data = json.loads(text)

        added = 0
        if "admin" not in data:
            data["admin"] = dict(NEW[loc])
            added = len(NEW[loc])
        else:
            for k, v in NEW[loc].items():
                if k not in data["admin"]:
                    data["admin"][k] = v
                    added += 1

        if added:
            out = json.dumps(data, ensure_ascii=False, indent=2)
            out_crlf = out.replace("\r\n", "\n").replace("\n", "\r\n") + "\r\n"
            with io.open(path, "w", encoding="utf-8", newline="") as f:
                f.write(out_crlf)
            raw_after = io.open(path, "rb").read()
            crlf_after = raw_after.count(b"\r\n")
            report.append(f"  {loc}: +{added} 键, CRLF {crlf_before} -> {crlf_after}")
        else:
            report.append(f"  {loc}: 无变化（键已存在）")

    print("[i18n] CS-16 admin 字典补齐完成")
    for line in report:
        print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
