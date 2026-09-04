# -*- coding: utf-8 -*-
"""
给 9 语字典的 customServices 注入「付款方式」区块。

背景：
  站点定价为 B2B 服务（核验 $99+ / 验厂 $399+），走"先询盘、后报价、线下成交"。
  用户决定：收款账户信息**不公开挂在网站上**，仅在确认订单后随报价单邮件发送
  （防钓鱼 + 符合 B2B 流程 + 便于先沟通再报价）。
  因此这里只描述"接受哪些付款方式、什么时候会给账户"，绝不出现任何账号数字。

设计约束：
  1. 幂等：已存在 paymentTitle 则跳过，可重复执行。
  2. 保序：用 OrderedDict 读回，保证 key 顺序不被打乱（否则 diff 会炸）。
  3. 格式一致：ensure_ascii=False + indent=2，与现有 9 个文件保持一致。
  4. 安全提示（paymentNote）是**必须项**：明确告知"我们不在网站公开账户、
     只从官方域名发送"，这是 B2B 电汇场景防钓鱼欺诈的标准做法。
"""

import collections
import json
import os

LOCALES = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"]

PAYMENT = {
    "en": {
        "paymentTitle": "How payment works",
        "paymentLead": "Payment is simple and traceable. We do not collect any card details on this website.",
        "paymentMethods": [
            {
                "title": "Bank transfer (T/T)",
                "body": "Our preferred method for audits and inspections. We send bank details together with your quotation, once scope and pricing are confirmed.",
            },
            {
                "title": "PayPal",
                "body": "Available for verification reports and smaller engagements. You receive a payment link by email — no PayPal account required.",
            },
            {
                "title": "Alipay",
                "body": "Available for clients settling in CNY. Details are provided with your quotation.",
            },
        ],
        "paymentNote": "We never publish bank account details on this website. Payment instructions are sent only from our official domain after your order is confirmed — please verify the sender before transferring funds.",
    },
    "zh": {
        "paymentTitle": "付款方式",
        "paymentLead": "付款流程简单可追溯。本站不收集任何银行卡信息。",
        "paymentMethods": [
            {
                "title": "银行电汇（T/T）",
                "body": "验厂与验货服务的首选方式。在与您确认服务范围与报价后，我们将随报价单一同发送收款账户信息。",
            },
            {
                "title": "PayPal",
                "body": "适用于核验报告及小额服务。我们将通过邮件发送付款链接，您无需注册 PayPal 账户即可付款。",
            },
            {
                "title": "支付宝",
                "body": "适用于以人民币结算的客户。账户信息随报价单提供。",
            },
        ],
        "paymentNote": "我们绝不在本网站公开银行账户信息。付款指引仅在订单确认后从我们的官方域名发出——转账前请务必核实发件人。",
    },
    "zh-TW": {
        "paymentTitle": "付款方式",
        "paymentLead": "付款流程簡單可追溯。本站不收集任何銀行卡資訊。",
        "paymentMethods": [
            {
                "title": "銀行電匯（T/T）",
                "body": "驗廠與驗貨服務的首選方式。在與您確認服務範圍與報價後，我們將隨報價單一同發送收款帳戶資訊。",
            },
            {
                "title": "PayPal",
                "body": "適用於核驗報告及小額服務。我們將透過郵件發送付款連結，您無需註冊 PayPal 帳戶即可付款。",
            },
            {
                "title": "支付寶",
                "body": "適用於以人民幣結算的客戶。帳戶資訊隨報價單提供。",
            },
        ],
        "paymentNote": "我們絕不在本網站公開銀行帳戶資訊。付款指引僅在訂單確認後從我們的官方網域發出——轉帳前請務必核實發件人。",
    },
    "es": {
        "paymentTitle": "Cómo funciona el pago",
        "paymentLead": "El pago es sencillo y rastreable. No recopilamos datos de tarjetas en este sitio.",
        "paymentMethods": [
            {
                "title": "Transferencia bancaria (T/T)",
                "body": "Nuestro método preferido para auditorías e inspecciones. Enviamos los datos bancarios junto con su presupuesto, una vez confirmados el alcance y el precio.",
            },
            {
                "title": "PayPal",
                "body": "Disponible para informes de verificación y servicios menores. Recibirá un enlace de pago por correo; no necesita cuenta PayPal.",
            },
            {
                "title": "Alipay",
                "body": "Disponible para clientes que liquidan en CNY. Los datos se facilitan con su presupuesto.",
            },
        ],
        "paymentNote": "Nunca publicamos datos bancarios en este sitio web. Las instrucciones de pago se envían únicamente desde nuestro dominio oficial tras confirmar su pedido: verifique el remitente antes de transferir.",
    },
    "de": {
        "paymentTitle": "So funktioniert die Zahlung",
        "paymentLead": "Die Zahlung ist einfach und nachvollziehbar. Auf dieser Website werden keine Kartendaten erfasst.",
        "paymentMethods": [
            {
                "title": "Banküberweisung (T/T)",
                "body": "Unsere bevorzugte Methode für Audits und Inspektionen. Wir senden die Bankdaten zusammen mit Ihrem Angebot, sobald Umfang und Preis bestätigt sind.",
            },
            {
                "title": "PayPal",
                "body": "Verfügbar für Verifizierungsberichte und kleinere Aufträge. Sie erhalten einen Zahlungslink per E-Mail – kein PayPal-Konto erforderlich.",
            },
            {
                "title": "Alipay",
                "body": "Verfügbar für Kunden, die in CNY abrechnen. Die Details erhalten Sie mit Ihrem Angebot.",
            },
        ],
        "paymentNote": "Wir veröffentlichen niemals Bankdaten auf dieser Website. Zahlungsanweisungen werden erst nach Auftragsbestätigung von unserer offiziellen Domain gesendet – bitte prüfen Sie den Absender vor der Überweisung.",
    },
    "fr": {
        "paymentTitle": "Comment fonctionne le paiement",
        "paymentLead": "Le paiement est simple et traçable. Nous ne collectons aucune donnée de carte sur ce site.",
        "paymentMethods": [
            {
                "title": "Virement bancaire (T/T)",
                "body": "Notre méthode privilégiée pour les audits et les inspections. Nous envoyons les coordonnées bancaires avec votre devis, une fois le périmètre et le prix confirmés.",
            },
            {
                "title": "PayPal",
                "body": "Disponible pour les rapports de vérification et les prestations de faible montant. Vous recevez un lien de paiement par e-mail — aucun compte PayPal requis.",
            },
            {
                "title": "Alipay",
                "body": "Disponible pour les clients réglant en CNY. Les coordonnées sont fournies avec votre devis.",
            },
        ],
        "paymentNote": "Nous ne publions jamais de coordonnées bancaires sur ce site. Les instructions de paiement sont envoyées uniquement depuis notre domaine officiel après confirmation de votre commande — vérifiez l'expéditeur avant tout virement.",
    },
    "pt": {
        "paymentTitle": "Como funciona o pagamento",
        "paymentLead": "O pagamento é simples e rastreável. Não coletamos dados de cartão neste site.",
        "paymentMethods": [
            {
                "title": "Transferência bancária (T/T)",
                "body": "Nosso método preferencial para auditorias e inspeções. Enviamos os dados bancários junto com sua cotação, após a confirmação do escopo e do preço.",
            },
            {
                "title": "PayPal",
                "body": "Disponível para relatórios de verificação e serviços menores. Você recebe um link de pagamento por e-mail — não é necessário ter conta PayPal.",
            },
            {
                "title": "Alipay",
                "body": "Disponível para clientes que liquidam em CNY. Os dados são fornecidos com sua cotação.",
            },
        ],
        "paymentNote": "Nunca publicamos dados bancários neste site. As instruções de pagamento são enviadas somente do nosso domínio oficial após a confirmação do pedido — verifique o remetente antes de transferir.",
    },
    "ja": {
        "paymentTitle": "お支払いについて",
        "paymentLead": "お支払いはシンプルで追跡可能です。本サイトではカード情報を一切収集しません。",
        "paymentMethods": [
            {
                "title": "銀行送金（T/T）",
                "body": "監査・検品サービスで推奨する方法です。サービス範囲と料金を確認した後、お見積書とともに銀行口座情報を送付します。",
            },
            {
                "title": "PayPal",
                "body": "検証レポートや小規模な案件でご利用いただけます。メールで支払いリンクをお送りします。PayPal アカウントは不要です。",
            },
            {
                "title": "Alipay",
                "body": "人民元（CNY）でのお支払いに対応しています。口座情報はお見積書とともにご案内します。",
            },
        ],
        "paymentNote": "当サイトでは銀行口座情報を一切公開していません。お支払いのご案内は、ご注文確定後に当社の公式ドメインからのみ送信されます。送金前に送信元を必ずご確認ください。",
    },
    "ar": {
        "paymentTitle": "كيف تتم عملية الدفع",
        "paymentLead": "الدفع بسيط وقابل للتتبع. لا نجمع أي بيانات بطاقات على هذا الموقع.",
        "paymentMethods": [
            {
                "title": "تحويل بنكي (T/T)",
                "body": "طريقتنا المفضلة لعمليات التدقيق والفحص. نرسل البيانات البنكية مع عرض السعر بعد تأكيد النطاق والسعر.",
            },
            {
                "title": "PayPal",
                "body": "متاح لتقارير التحقق والخدمات الأصغر. ستتلقى رابط دفع عبر البريد الإلكتروني — دون الحاجة إلى حساب PayPal.",
            },
            {
                "title": "Alipay",
                "body": "متاح للعملاء الذين يسددون باليوان الصيني (CNY). تُقدَّم البيانات مع عرض السعر.",
            },
        ],
        "paymentNote": "لا ننشر أبداً أي بيانات بنكية على هذا الموقع. تُرسَل تعليمات الدفع من نطاقنا الرسمي فقط بعد تأكيد طلبك — يُرجى التحقق من المُرسِل قبل التحويل.",
    },
}


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for loc in LOCALES:
        path = os.path.join(root, "i18n", "dictionaries", f"{loc}.json")
        with open(path, encoding="utf-8") as f:
            data = json.load(f, object_pairs_hook=collections.OrderedDict)

        cs = data.get("customServices")
        if not isinstance(cs, dict):
            print(f"  ! {loc}: 无 customServices，跳过")
            continue
        if "paymentTitle" in cs:
            print(f"  - {loc}: 已存在付款区块，跳过（幂等）")
            continue

        cs.update(PAYMENT[loc])
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"  + {loc}: 已注入付款方式区块")


if __name__ == "__main__":
    main()
