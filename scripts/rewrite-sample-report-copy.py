# -*- coding: utf-8 -*-
"""
一次性重写 sample-report 留资表单文案（9 语言）。

背景：原文案承诺「留下邮箱 → 立即发送完整样例报告（PDF）+ 一页阅读指南」，
但代码链路 SampleReportForm → POST /api/lead 只发两条通知邮件，
客户侧那条内容是「已收到你的请求，一个工作日内回复」，根本没有发报告的功能；
且因 Resend 域名未验证，这条回执本身也 403 发不出去。前端却照常显示「报告即将送达」。

新文案去掉三处虚假承诺：
  1. 不再承诺 PDF 具体格式（代码不保证格式）
  2. 补上真实时间预期 within one business day（人工跟进发送）
  3. formSuccess 不再说「即将送达」，改成「已收到请求 + 一个工作日内发送」
  4. formCta 从「发送报告给我」改为「申请/请求完整报告」（请求 → 人工处理）
  5. formPrivacyNote 补上「用于跟进」

用法：python scripts/rewrite-sample-report-copy.py
"""

import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 语言 → (formTitle, formLead, formCta, formSuccess, formPrivacyNote)
COPY = {
    "en": (
        "Get the full sample report",
        "Leave your email and we will send you the complete sample report with a one-page reading guide within one business day.",
        "Request the full report",
        "Thanks. We have your request and will send the full sample report within one business day.",
        "We use your email to send the report and follow up. No spam, unsubscribe anytime.",
    ),
    "zh": (
        "获取完整样例报告",
        "留下您的邮箱，我们会在一个工作日内把完整样例报告和一页阅读指南发送给您。",
        "申请完整报告",
        "已收到您的请求。我们会在一个工作日内把完整样例报告发送到您的邮箱。",
        "我们用您的邮箱发送报告并与您跟进。不发送垃圾邮件，可随时退订。",
    ),
    "zh-TW": (
        "取得完整範例報告",
        "留下您的信箱，我們會在一個工作日內把完整範例報告和一頁閱讀指南發送給您。",
        "申請完整報告",
        "已收到您的請求。我們會在一個工作日內把完整範例報告發送到您的信箱。",
        "我們用您的信箱發送報告並與您跟進。不發送垃圾郵件，可隨時退訂。",
    ),
    "es": (
        "Obtenga el informe de muestra completo",
        "Deje su correo y le enviaremos el informe de muestra completo con una guía de lectura de una página en un día laborable.",
        "Solicitar el informe completo",
        "Gracias. Hemos recibido su solicitud y le enviaremos el informe completo en un día laborable.",
        "Usamos su correo para enviar el informe y hacer seguimiento. Sin spam, puede darse de baja cuando quiera.",
    ),
    "de": (
        "Den vollständigen Beispielbericht erhalten",
        "Hinterlassen Sie Ihre E-Mail und wir senden Ihnen den vollständigen Beispielbericht mit einer einseitigen Leseanleitung innerhalb eines Werktages.",
        "Vollständigen Bericht anfordern",
        "Danke. Wir haben Ihre Anfrage und senden den vollständigen Beispielbericht innerhalb eines Werktages.",
        "Wir nutzen Ihre E-Mail für den Bericht und die Nachverfolgung. Kein Spam, jederzeit abbestellbar.",
    ),
    "fr": (
        "Recevoir le rapport d'exemple complet",
        "Laissez votre e-mail et nous vous enverrons le rapport complet avec un guide de lecture d'une page sous un jour ouvré.",
        "Demander le rapport complet",
        "Merci. Nous avons bien reçu votre demande et vous enverrons le rapport complet sous un jour ouvré.",
        "Nous utilisons votre e-mail pour envoyer le rapport et assurer le suivi. Pas de spam, désinscription à tout moment.",
    ),
    "pt": (
        "Receba o relatório de amostra completo",
        "Deixe seu e-mail e enviaremos o relatório completo com um guia de leitura de uma página em um dia útil.",
        "Solicitar o relatório completo",
        "Obrigado. Recebemos seu pedido e enviaremos o relatório completo em um dia útil.",
        "Usamos seu e-mail para enviar o relatório e fazer o acompanhamento. Sem spam, cancele quando quiser.",
    ),
    "ja": (
        "完全なサンプルレポートを受け取る",
        "メールアドレスを残していただければ、完全なサンプルレポートと1ページの読み方ガイドを1営業日以内にお送りします。",
        "完全レポートを請求する",
        "リクエストを受け付けました。完全なサンプルレポートを1営業日以内にお送りします。",
        "メールはレポートの送付とフォローアップに使用します。迷惑メールは送信せず、いつでも購読解除できます。",
    ),
    "ar": (
        "احصل على تقرير العينة الكامل",
        "اترك بريدك الإلكتروني وسنرسل لك تقرير العينة الكامل مع دليل قراءة من صفحة واحدة خلال يوم عمل واحد.",
        "اطلب التقرير الكامل",
        "شكرًا لك. استلمنا طلبك وسنرسل تقرير العينة الكامل خلال يوم عمل واحد.",
        "نستخدم بريدك لإرسال التقرير والمتابعة معك. لا رسائل مزعجة، يمكنك إلغاء الاشتراك في أي وقت.",
    ),
}

KEYS = ["formTitle", "formLead", "formCta", "formSuccess", "formPrivacyNote"]


def replace_key(text: str, key: str, new_value: str, lang: str) -> tuple:
    """只替换 sampleReport 块内的目标 key，返回 (新文本, 是否命中)。"""
    # 定位 sampleReport 块
    m_block = re.search(r'"sampleReport"\s*:\s*\{', text)
    if not m_block:
        return text, False

    start = m_block.end()
    # 从块起点做花括号配平，找到块的结束位置
    depth = 1
    i = start
    while i < len(text) and depth > 0:
        ch = text[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        elif ch == '"':
            # 跳过字符串，避免字符串内的花括号干扰配平
            i += 1
            while i < len(text):
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == '"':
                    break
                i += 1
        i += 1
    end = i

    block = text[start:end]
    pattern = re.compile(r'("' + re.escape(key) + r'"\s*:\s*)"(?:[^"\\]|\\.)*"')
    new_block, n = pattern.subn(
        lambda m: m.group(1) + '"' + new_value.replace("\\", "\\\\").replace('"', '\\"') + '"',
        block,
        count=1,
    )
    if n == 0:
        return text, False
    return text[:start] + new_block + text[end:], True


def main() -> int:
    changed = 0
    for lang, values in COPY.items():
        path = os.path.join(ROOT, "i18n", "dictionaries", f"{lang}.json")
        if not os.path.exists(path):
            print(f"[skip] {lang}: 文件不存在")
            continue
        # newline="" 关掉通用换行转换，否则 Windows 上会把 CRLF 读成 LF，
        # 写回时整份文件的行尾被改掉（实测会让 diff 变成几千行）。
        text = io.open(path, encoding="utf-8", newline="").read()
        original = text
        hits = []
        for key, value in zip(KEYS, values):
            text, ok = replace_key(text, key, value, lang)
            hits.append(f"{key}={'ok' if ok else 'MISS'}")
        if text == original:
            print(f"[skip] {lang}: 无变化")
            continue
        io.open(path, "w", encoding="utf-8", newline="").write(text)
        changed += 1
        print(f"[done] {lang}: " + " ".join(hits))
    print(f"\n共改写 {changed} 个文件")
    return 0


if __name__ == "__main__":
    sys.exit(main())
