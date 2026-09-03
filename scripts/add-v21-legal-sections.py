# -*- coding: utf-8 -*-
"""
V2.1 法务条款补齐：给 9 语字典的 legal.termsSections / legal.privacySections
各追加 2 条与「会员订阅 + 退款 + 账号/支付数据」相关的条款。

为什么必须补：V2.1 开始真实收款（Stripe $99/年），收钱前必须有退款政策。
文案全部是本站真实做法的事实陈述，不做无据承诺。

写法：行级精确插入（不整体 json.dumps 重写），保持原有 2 空格缩进与 CRLF。
"""
import io
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT_DIR = os.path.join(HERE, "i18n", "dictionaries")

UPDATED = "2026-09-03"

# ---------------- 条款文案（9 语） ----------------
# terms: 订阅与账单、退款与取消
# privacy: 账号数据、支付数据
TERMS = {
    "en": [
        ("Membership, billing and renewal",
         "Founding Buyer Membership is an annual subscription priced at USD 99 per year. Payment is processed by Stripe. Your subscription renews automatically each year unless you cancel before the renewal date. You can view your renewal date or cancel at any time from your account page."),
        ("Refunds and cancellation",
         "You can cancel at any time from your account page. Cancellation takes effect at the end of the current billing period, and there is no cancellation fee. If you cancel within 14 days of your first payment, contact us for a full refund. After 14 days we do not offer pro-rated refunds, because membership grants immediate access to paid content."),
    ],
    "zh": [
        ("会员、账单与续费",
         "Founding Buyer 会员为年度订阅，价格 99 美元/年，由 Stripe 处理付款。除非您在续费日前取消，否则订阅每年自动续费。您可随时在账号页面查看续费日期或取消订阅。"),
        ("退款与取消",
         "您可随时在账号页面取消会员。取消在当前计费周期结束时生效，不收取取消费用。首次付款后 14 天内取消，请联系我们全额退款。超过 14 天不予按比例退款，因为会员在购买后立即获得付费内容访问权限。"),
    ],
    "zh-TW": [
        ("會員、帳單與續費",
         "Founding Buyer 會員為年度訂閱，價格 99 美元/年，由 Stripe 處理付款。除非您在續費日前取消，否則訂閱每年自動續費。您可隨時在帳號頁面查看續費日期或取消訂閱。"),
        ("退款與取消",
         "您可隨時在帳號頁面取消會員。取消於目前計費週期結束時生效，不收取取消費用。首次付款後 14 天內取消，請與我們聯繫辦理全額退款。超過 14 天不提供按比例退款，因為會員在購買後立即取得付費內容存取權限。"),
    ],
    "es": [
        ("Membresía, facturación y renovación",
         "La Membresía Founding Buyer es una suscripción anual de 99 USD al año. El pago se procesa con Stripe. La suscripción se renueva automáticamente cada año, salvo que la cancele antes de la fecha de renovación. Puede ver la fecha de renovación o cancelar en cualquier momento desde su página de cuenta."),
        ("Reembolsos y cancelación",
         "Puede cancelar en cualquier momento desde su página de cuenta. La cancelación surte efecto al final del periodo de facturación actual y no hay cargo por cancelación. Si cancela dentro de los 14 días posteriores a su primer pago, contáctenos para obtener un reembolso completo. Después de 14 días no ofrecemos reembolsos proporcionales, porque la membresía da acceso inmediato al contenido de pago."),
    ],
    "de": [
        ("Mitgliedschaft, Abrechnung und Verlängerung",
         "Die Founding Buyer Membership ist ein Jahresabonnement für 99 USD pro Jahr. Die Zahlung wird über Stripe abgewickelt. Ihr Abonnement verlängert sich jedes Jahr automatisch, sofern Sie nicht vor dem Verlängerungsdatum kündigen. Sie können Ihr Verlängerungsdatum einsehen oder jederzeit auf Ihrer Kontoseite kündigen."),
        ("Erstattungen und Kündigung",
         "Sie können jederzeit auf Ihrer Kontoseite kündigen. Die Kündigung wirkt zum Ende des laufenden Abrechnungszeitraums; es fallen keine Kündigungsgebühren an. Wenn Sie innerhalb von 14 Tagen nach Ihrer ersten Zahlung kündigen, kontaktieren Sie uns für eine vollständige Erstattung. Nach 14 Tagen bieten wir keine anteiligen Erstattungen an, da die Mitgliedschaft sofortigen Zugriff auf kostenpflichtige Inhalte gewährt."),
    ],
    "fr": [
        ("Adhésion, facturation et renouvellement",
         "L’adhésion Founding Buyer est un abonnement annuel au prix de 99 USD par an. Le paiement est traité par Stripe. Votre abonnement se renouvelle automatiquement chaque année, sauf si vous l’annulez avant la date de renouvellement. Vous pouvez consulter votre date de renouvellement ou annuler à tout moment depuis votre page de compte."),
        ("Remboursements et annulation",
         "Vous pouvez annuler à tout moment depuis votre page de compte. L’annulation prend effet à la fin de la période de facturation en cours et aucuns frais d’annulation ne sont appliqués. Si vous annulez dans les 14 jours suivant votre premier paiement, contactez-nous pour un remboursement intégral. Après 14 jours, nous n’accordons pas de remboursement au prorata, car l’adhésion donne un accès immédiat au contenu payant."),
    ],
    "pt": [
        ("Assinatura, cobrança e renovação",
         "A assinatura Founding Buyer é anual, ao preço de 99 USD por ano. O pagamento é processado pela Stripe. A assinatura renova automaticamente todos os anos, salvo se você cancelar antes da data de renovação. Você pode ver a data de renovação ou cancelar a qualquer momento na página da sua conta."),
        ("Reembolsos e cancelamento",
         "Você pode cancelar a qualquer momento na página da sua conta. O cancelamento passa a valer no fim do ciclo de cobrança atual e não há taxa de cancelamento. Se cancelar em até 14 dias após o primeiro pagamento, fale conosco para obter o reembolso integral. Após 14 dias não oferecemos reembolso proporcional, pois a assinatura dá acesso imediato ao conteúdo pago."),
    ],
    "ja": [
        ("会員・請求・更新について",
         "Founding Buyer メンバーシップは年額 99 米ドルの年間サブスクリプションです。お支払いは Stripe が処理します。更新日の前に解約しない限り、サブスクリプションは毎年自動的に更新されます。更新日の確認や解約は、アカウントページからいつでも行えます。"),
        ("返金と解約",
         "解約はアカウントページからいつでも行えます。解約は現在の請求期間の終了時に効力を生じ、解約手数料はかかりません。初回お支払いから 14 日以内に解約された場合は、全額返金についてご連絡ください。14 日を過ぎた場合は日割り返金はいたしません。メンバーシップは購入後ただちに有料コンテンツへアクセスできるためです。"),
    ],
    "ar": [
        ("العضوية والفوترة والتجديد",
         "عضوية Founding Buyer هي اشتراك سنوي سعره 99 دولاراً أمريكياً في السنة. تتم معالجة الدفع عبر Stripe. يتجدد اشتراكك تلقائياً كل سنة ما لم تلغه قبل تاريخ التجديد. يمكنك الاطلاع على تاريخ التجديد أو الإلغاء في أي وقت من صفحة حسابك."),
        ("المبالغ المستردة والإلغاء",
         "يمكنك الإلغاء في أي وقت من صفحة حسابك. يسري الإلغاء في نهاية فترة الفوترة الحالية ولا توجد رسوم إلغاء. إذا ألغيت خلال 14 يوماً من أول دفعة، تواصل معنا لاسترداد المبلغ كاملاً. بعد 14 يوماً لا نقدم مبالغ مستردة نسبية، لأن العضوية تمنح وصولاً فورياً إلى المحتوى المدفوع."),
    ],
}

PRIVACY = {
    "en": [
        ("Account data",
         "If you create an account, we store your email address, name, company name and membership status. Passwords are handled by our authentication provider and are never visible to us. You can ask us to delete your account data at any time."),
        ("Payment data",
         "Payments are processed by Stripe. We never see or store your full card number. We store only the card brand, last four digits, subscription status and renewal date needed to run your membership."),
    ],
    "zh": [
        ("账号数据",
         "创建账号后，我们会存储您的邮箱、姓名、公司名称与会员状态。密码由我们的身份验证服务提供方处理，我们无法看到。您可随时要求删除账号数据。"),
        ("支付数据",
         "付款由 Stripe 处理。我们不会看到或存储您的完整卡号，仅保存运营会员所需的卡品牌、卡号后四位、订阅状态与续费日期。"),
    ],
    "zh-TW": [
        ("帳號資料",
         "建立帳號後，我們會儲存您的電子郵件、姓名、公司名稱與會員狀態。密碼由我們的身分驗證服務供應商處理，我們無法看見。您可隨時要求刪除帳號資料。"),
        ("付款資料",
         "付款由 Stripe 處理。我們不會看到或儲存您的完整卡號，僅保存營運會員所需的卡品牌、卡號末四碼、訂閱狀態與續費日期。"),
    ],
    "es": [
        ("Datos de la cuenta",
         "Si crea una cuenta, almacenamos su correo electrónico, nombre, nombre de la empresa y estado de la membresía. Las contraseñas las gestiona nuestro proveedor de autenticación y nunca son visibles para nosotros. Puede solicitarnos la eliminación de los datos de su cuenta en cualquier momento."),
        ("Datos de pago",
         "Los pagos los procesa Stripe. Nunca vemos ni almacenamos el número completo de su tarjeta. Solo guardamos la marca de la tarjeta, los últimos cuatro dígitos, el estado de la suscripción y la fecha de renovación necesarios para gestionar su membresía."),
    ],
    "de": [
        ("Kontodaten",
         "Wenn Sie ein Konto erstellen, speichern wir Ihre E-Mail-Adresse, Ihren Namen, Ihren Firmennamen und Ihren Mitgliedschaftsstatus. Passwörter werden von unserem Authentifizierungsanbieter verwaltet und sind für uns niemals sichtbar. Sie können jederzeit die Löschung Ihrer Kontodaten verlangen."),
        ("Zahlungsdaten",
         "Zahlungen werden von Stripe verarbeitet. Wir sehen oder speichern niemals Ihre vollständige Kartennummer. Wir speichern nur Kartenmarke, die letzten vier Stellen, den Abonnementstatus und das Verlängerungsdatum, die für den Betrieb Ihrer Mitgliedschaft erforderlich sind."),
    ],
    "fr": [
        ("Données du compte",
         "Si vous créez un compte, nous stockons votre adresse e-mail, votre nom, le nom de votre entreprise et votre statut d’adhésion. Les mots de passe sont gérés par notre fournisseur d’authentification et ne nous sont jamais visibles. Vous pouvez demander la suppression des données de votre compte à tout moment."),
        ("Données de paiement",
         "Les paiements sont traités par Stripe. Nous ne voyons ni ne stockons jamais votre numéro de carte complet. Nous conservons uniquement la marque de la carte, les quatre derniers chiffres, le statut de l’abonnement et la date de renouvellement nécessaires au fonctionnement de votre adhésion."),
    ],
    "pt": [
        ("Dados da conta",
         "Ao criar uma conta, armazenamos seu e-mail, nome, nome da empresa e status da assinatura. As senhas são gerenciadas pelo nosso provedor de autenticação e nunca ficam visíveis para nós. Você pode solicitar a exclusão dos dados da sua conta a qualquer momento."),
        ("Dados de pagamento",
         "Os pagamentos são processados pela Stripe. Nunca vemos ou armazenamos o número completo do seu cartão. Guardamos apenas a bandeira do cartão, os quatro últimos dígitos, o status da assinatura e a data de renovação necessários para operar sua assinatura."),
    ],
    "ja": [
        ("アカウントデータ",
         "アカウントを作成した場合、メールアドレス、お名前、会社名、会員ステータスを保存します。パスワードは認証プロバイダーが管理し、当社が閲覧することはできません。アカウントデータの削除はいつでもご請求いただけます。"),
        ("お支払いデータ",
         "お支払いは Stripe が処理します。当社がカード番号の全桁を確認または保存することはありません。会員サービスの運営に必要なカードブランド、下 4 桁、サブスクリプションの状態、更新日のみを保存します。"),
    ],
    "ar": [
        ("بيانات الحساب",
         "إذا أنشأت حساباً، نخزن عنوان بريدك الإلكتروني واسمك واسم شركتك وحالة عضويتك. تتولى جهة المصادقة لدينا إدارة كلمات المرور ولا تكون مرئية لنا أبداً. يمكنك طلب حذف بيانات حسابك في أي وقت."),
        ("بيانات الدفع",
         "تتم معالجة المدفوعات عبر Stripe. لا نرى ولا نخزن رقم بطاقتك الكامل أبداً. نخزن فقط العلامة التجارية للبطاقة والأرقام الأربعة الأخيرة وحالة الاشتراك وتاريخ التجديد اللازمة لتشغيل عضويتك."),
    ],
}

# 更新日期文案（9 语）
UPDATED_TEXT = {
    "en": "Last updated: ", "zh": "最后更新：", "zh-TW": "最後更新：",
    "es": "Última actualización: ", "de": "Zuletzt aktualisiert: ",
    "fr": "Dernière mise à jour : ", "pt": "Última atualização: ",
    "ja": "最終更新日：", "ar": "آخر تحديث: ",
}


def esc(s: str) -> str:
    """JSON 字符串内容转义（本文件文案只涉及双引号与反斜杠风险）"""
    return s.replace("\\", "\\\\").replace('"', '\\"')


def find_array_end(lines, start_idx):
    """从 `    "xxx": [` 所在行向下找匹配的收尾行。

    注意：数组后面还有别的 key 时结尾是 `    ],`（带逗号），
    是对象最后一个 key 时才是 `    ]`。两种都要认 ——
    首版只匹配 `    ]`，结果跳过了真正的结尾，把条款插进了
    下一个数组里（termsSections 被污染）。
    """
    for i in range(start_idx + 1, len(lines)):
        s = lines[i]
        if s == "    ]" or s == "    ],":
            return i
    raise RuntimeError(f"找不到数组结尾: 起始行 {start_idx}")


def array_len(lines, key):
    """数一下某个 `{h, b}` 数组当前有几条（按 `"h":` 计数）"""
    start = None
    for i, l in enumerate(lines):
        if l.strip().startswith(f'"{key}"'):
            start = i
            break
    if start is None:
        raise RuntimeError(f"找不到 {key}")
    end = find_array_end(lines, start)
    return start, end, sum(1 for l in lines[start:end] if l.strip().startswith('"h":'))


def insert_sections(lines, key, items):
    """在 key 数组的结尾前插入 items（list of (h, b)），返回 (新lines, 插入前条数, 插入后条数)"""
    start, end, before = array_len(lines, key)

    # 前一个元素结尾补逗号（原最后一项没有逗号）
    prev = lines[end - 1]
    if prev == "      }":
        lines[end - 1] = "      },"

    block = []
    for idx, (h, b) in enumerate(items):
        block.append("      {")
        block.append(f'        "h": "{esc(h)}",')
        block.append(f'        "b": "{esc(b)}"')
        block.append("      }" + ("," if idx < len(items) - 1 else ""))
    new_lines = lines[:end] + block + lines[end:]

    _, _, after = array_len(new_lines, key)
    return new_lines, before, after


def set_updated(lines, key, locale):
    """更新 Last updated 行"""
    prefix = UPDATED_TEXT[locale]
    for i, l in enumerate(lines):
        if l.strip().startswith(f'"{key}"'):
            lines[i] = f'    "{key}": "{prefix}{UPDATED}",'
            return lines
    return lines


def main():
    locales = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"]
    report = []
    for loc in locales:
        path = os.path.join(DICT_DIR, f"{loc}.json")

        # 铁律：读写两端都加 newline=""，否则 CRLF 会被改成 LF，整文件 diff 爆炸
        raw = io.open(path, encoding="utf-8", newline="").read()
        crlf_before = raw.count("\r\n")
        lines = raw.split("\r\n")

        lines, p_before, p_after = insert_sections(lines, "privacySections", PRIVACY[loc])
        lines, t_before, t_after = insert_sections(lines, "termsSections", TERMS[loc])
        lines = set_updated(lines, "privacyUpdated", loc)
        lines = set_updated(lines, "termsUpdated", loc)

        out = "\r\n".join(lines)
        io.open(path, "w", encoding="utf-8", newline="").write(out)

        # 回读校验
        chk = io.open(path, encoding="utf-8", newline="").read()
        crlf_after = chk.count("\r\n")
        import json
        d = json.loads(chk)  # 语法校验，坏 JSON 会直接抛错

        # 三重断言：条数真的增加了 / 纯 CRLF / 新条款确实在该在的数组里
        expect_terms = t_before + 2
        expect_privacy = p_before + 2
        got_terms = len(d["legal"]["termsSections"])
        got_privacy = len(d["legal"]["privacySections"])
        pure_crlf = chk.count("\r\n") == chk.count("\n")
        t_titles = [s["h"] for s in d["legal"]["termsSections"]]
        p_titles = [s["h"] for s in d["legal"]["privacySections"]]
        t_ok = t_titles[-1] == TERMS[loc][-1][0]
        p_ok = p_titles[-1] == PRIVACY[loc][-1][0]

        ok = (
            got_terms == expect_terms
            and got_privacy == expect_privacy
            and pure_crlf
            and t_ok
            and p_ok
        )
        report.append(
            f"  {loc:6s} terms {t_before}->{got_terms}  privacy {p_before}->{got_privacy}  "
            f"CRLF {crlf_before}->{crlf_after} 纯CRLF={pure_crlf} 末尾正确={t_ok and p_ok}  "
            f"{'OK' if ok else '!!FAIL!!'}"
        )
        if not ok:
            raise RuntimeError(f"{loc} 校验未通过，已写入但结果错误 —— 请从备份恢复后排查")

    print("=== 法务条款补齐完成 ===")
    for r in report:
        print(r)


if __name__ == "__main__":
    main()
