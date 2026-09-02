# -*- coding: utf-8 -*-
"""修正 aiChat.fallbackAnswers 里两处与现状不符的答案：
1) coverage：仍写「中国、越南、泰国」3 国，实际 COVERAGE_COUNTRIES 已是 5 国
   （china / vietnam / thailand / malaysia / philippines）
2) pricing：仍写 V1 的「Buyer SaaS $0–299/month」（该产品已不存在），
   且漏了 Founding Buyer 会员 $99/year

改法：先锚定 "fallbackAnswers"，再在其后定位 key，精确替换整条字符串。
不做 json round-trip（避免整份文件重排）。读写两端都加 newline=""，
否则 Windows 上会把 CRLF 全改成 LF。
"""
import io
import os
import shutil

LANGS = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"]
BACKUP = ".workbuddy/dict-backup-before-aichat"

COVERAGE = {
    "en": "We cover China, Vietnam, Thailand, Malaysia and the Philippines. Tell me which country you are sourcing from and I will confirm what we can check there.",
    "zh": "我们目前覆盖中国、越南、泰国、马来西亚和菲律宾。告诉我你从哪个国家采购，我会确认在当地可以做哪些核查。",
    "zh-TW": "我們目前覆蓋中國、越南、泰國、馬來西亞和菲律賓。告訴我你從哪個國家採購，我會確認在當地可以做哪些查核。",
    "es": "Cubrimos China, Vietnam, Tailandia, Malasia y Filipinas. Dime desde qué país compras y confirmaré qué podemos verificar allí.",
    "de": "Wir decken China, Vietnam, Thailand, Malaysia und die Philippinen ab. Nennen Sie uns Ihr Beschaffungsland und wir bestätigen, was wir dort prüfen können.",
    "fr": "Nous couvrons la Chine, le Vietnam, la Thaïlande, la Malaisie et les Philippines. Indiquez-nous votre pays d'approvisionnement et nous confirmerons ce que nous pouvons vérifier sur place.",
    "pt": "Cobrimos China, Vietnã, Tailândia, Malásia e Filipinas. Diga de qual país você compra e confirmaremos o que podemos verificar lá.",
    "ja": "現在の対応国は中国、ベトナム、タイ、マレーシア、フィリピンです。調達先の国を教えていただければ、現地で何を確認できるかご案内します。",
    "ar": "نغطي حالياً الصين وفيتنام وتايلاند وماليزيا والفلبين. أخبرنا من أي بلد تشتري وسنؤكد ما يمكننا التحقق منه هناك.",
}

PRICING = {
    "en": "Free tools are $0. Supplier verification is $99 – $129 per supplier, factory audits start at 399 USD per man-day plus travel, and supplier monitoring is quoted per supplier per year. Founding Buyer membership is $99/year for full database access. Sourcing carries a 3–5% commission, quoted before you order. All prices in USD. Tell me your product and country.",
    "zh": "免费工具为 $0。供应商核查每个供应商 $99 – $129，工厂验厂 399 美元起（按人天，另加差旅），供应商监控按每个供应商每年报价。Founding Buyer 会员 $99/年，可查看完整供应商数据库。采购寻源按订单金额收取 3–5% 佣金，下单前报价。所有价格以美元计。告诉我你的产品和国家。",
    "zh-TW": "免費工具為 $0。供應商查核每個供應商 $99 – $129，工廠驗廠 399 美元起（按人天，另加差旅），供應商監控按每個供應商每年報價。Founding Buyer 會員 $99/年，可查看完整供應商資料庫。採購尋源按訂單金額收取 3–5% 佣金，下單前報價。所有價格以美元計。告訴我你的產品和國家。",
    "es": "Las herramientas gratuitas cuestan $0. La verificación de proveedores cuesta $99 – $129 por proveedor, la auditoría de fábrica desde 399 USD por día-hombre más viaje, y el monitoreo se presupuesta por proveedor y año. La membresía Founding Buyer cuesta 99 $/año y da acceso a toda la base de proveedores. El sourcing tiene una comisión del 3–5 %, presupuestada antes del pedido. Todos los precios en USD. Dime tu producto y país.",
    "de": "Kostenlose Tools kosten $0. Die Lieferantenverifizierung kostet $99 – $129 pro Lieferant, das Werksaudit ab 399 USD pro Personentag zuzüglich Reisekosten, und das Lieferanten-Monitoring wird pro Lieferant und Jahr angeboten. Die Founding-Buyer-Mitgliedschaft kostet 99 $/Jahr und umfasst die gesamte Lieferantendatenbank. Sourcing wird mit 3–5 % Provision auf den Auftragswert berechnet, vor Auftragserteilung angeboten. Alle Preise in USD. Nennen Sie uns Produkt und Land.",
    "fr": "Les outils gratuits sont à $0. La vérification fournisseur coûte $99 – $129 par fournisseur, l'audit d'usine à partir de 399 USD par jour-homme plus le déplacement, et le monitoring est chiffré par fournisseur et par an. L'adhésion Founding Buyer coûte 99 $/an et donne accès à toute la base de fournisseurs. Le sourcing est facturé avec une commission de 3–5 %, chiffrée avant la commande. Tous les prix en USD. Indiquez-nous votre produit et votre pays.",
    "pt": "As ferramentas gratuitas custam $0. A verificação de fornecedores custa $99 – $129 por fornecedor, a auditoria de fábrica a partir de 399 USD por homem-dia mais deslocação, e o monitoramento é orçado por fornecedor e por ano. A assinatura Founding Buyer custa US$ 99/ano e dá acesso a toda a base de fornecedores. O sourcing tem comissão de 3–5%, orçada antes do pedido. Todos os preços em USD. Diga-nos o seu produto e país.",
    "ja": "無料ツールは $0 です。サプライヤー核查は 1 社あたり $99 – $129、工場監査は 399 米ドルから（人日単位、別途出張費）、サプライヤーモニタリングは 1 社あたり年額で見積もります。Founding Buyer 会員は年間 $99 で、全サプライヤーデータベースを閲覧できます。調達支援は発注金額の 3〜5% の手数料で、発注前に見積もります。価格はすべて米ドルです。製品と国を教えていただければ、適したプランをご案内します。",
    "ar": "الأدوات المجانية بـ $0. التحقق من المورد يكلّف $99 – $129 لكل مورد، وتدقيق المصنع يبدأ من 399 دولاراً أمريكياً لكل يوم عمل إضافة إلى السفر، ومراقبة الموردين تُسعَّر لكل مورد سنوياً. عضوية Founding Buyer بـ 99$ سنوياً وتتيح الوصول إلى قاعدة الموردين كاملة. التوريد بعمولة 3–5% على قيمة الطلب، وتُسعَّر قبل تقديم الطلب. جميع الأسعار بالدولار الأمريكي. أخبرنا بمنتجك وبلدك.",
}

# 旧答案的判据（防止替换错位置）
STALE_MARK = {
    "coverage": ["Thailand", "泰国", "泰國", "Tailandia", "Thaïlande", "Tailândia", "タイ", "تايلاند"],
    # ar 旧答案用的是阿拉伯-印度数字（٠-٢٩٩），必须一起列进判据
    "pricing": ["299", "٢٩٩"],
}


def find_value_span(text, key, start_at):
    """从 start_at 起找 "key": "，返回 (值起点, 值终点)；找不到返回 None。"""
    marker = '"%s": "' % key
    i = text.find(marker, start_at)
    if i < 0:
        return None
    s = i + len(marker)
    j = s
    while j < len(text):
        if text[j] == "\\":
            j += 2
            continue
        if text[j] == '"':
            break
        j += 1
    return s, j


def main():
    os.makedirs(BACKUP, exist_ok=True)
    total = 0
    for lang in LANGS:
        path = os.path.join("i18n", "dictionaries", f"{lang}.json")
        src = io.open(path, encoding="utf-8", newline="").read()

        anchor = src.find('"fallbackAnswers"')
        if anchor < 0:
            print("[WARN] %s 找不到 fallbackAnswers" % lang)
            continue

        text = src
        for key, table in (("coverage", COVERAGE), ("pricing", PRICING)):
            span = find_value_span(text, key, anchor)
            if span is None:
                print("[WARN] %s.%s 未找到" % (lang, key))
                continue
            s, j = span
            old = text[s:j]
            if not any(m in old for m in STALE_MARK[key]):
                print("[WARN] %s.%s 旧值不含过期特征，跳过：%s" % (lang, key, old[:60]))
                continue
            text = text[:s] + table[lang] + text[j:]
            total += 1

        if text != src:
            shutil.copy2(path, os.path.join(BACKUP, f"{lang}.json"))
            io.open(path, "w", encoding="utf-8", newline="").write(text)
            print("[ok] %s 已更新" % lang)
        else:
            print("[skip] %s 无变化" % lang)
    print("共替换 %d 处" % total)


if __name__ == "__main__":
    main()
