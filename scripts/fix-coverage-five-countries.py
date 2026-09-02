# -*- coding: utf-8 -*-
"""修正 9 语言里 4 处「覆盖国」文案：

1) coverage.lead      : "three countries" → 实际已是 5 国
2) coverage.metaDesc  : 只列 3 国 → 5 国
                        （zh / zh-TW 这条更严重：整段被写成了风险评分工具的说明，
                          跟 coverage 页完全无关，属于串行错误）
3) servicesIndex.metaDesc : 只列 3 国 → 5 国
                        （ar 这条开头有杂串 ":: "；de / ja / ar 有机器翻译痕迹）
4) trust.scopeBody    : 只列 3 国 → 5 国

依据：lib/coverage.ts 的 COVERAGE_COUNTRIES =
      china / vietnam / thailand / malaysia / philippines（5 国）

做法：先 json load 取出旧值，再在原文里精确替换（不 round-trip，避免整份文件重排）。
读写两端都加 newline=""，否则 Windows 上 CRLF 会被改成 LF。
"""
import io
import os
import shutil

LANGS = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"]
BACKUP = ".workbuddy/dict-backup-before-coverage5"

# (路径, {lang: 新值})
CHANGES = [
    ("coverage.lead", {
        "en": "On-the-ground supplier verification and factory audit support across China and Southeast Asia. Phase 1 covers five countries: China, Vietnam, Thailand, Malaysia and the Philippines. More are added as we have verified auditor capacity in them.",
        "zh": "覆盖中国及东南亚的现场供应商核查与工厂验厂支持。第一阶段覆盖五个国家：中国、越南、泰国、马来西亚、菲律宾。其余国家在审核员资源确认后逐步加入。",
        "zh-TW": "覆蓋中國及東南亞的現場供應商查核與工廠驗廠支援。第一階段覆蓋五個國家：中國、越南、泰國、馬來西亞、菲律賓。其餘國家在稽核員資源確認後逐步加入。",
        "es": "Verificación de proveedores sobre el terreno y soporte de auditoría de fábrica en China y el sudeste asiático. La fase 1 abarca cinco países: China, Vietnam, Tailandia, Malasia y Filipinas. Se añaden más a medida que verificamos la capacidad de los auditores en ellos.",
        "de": "Lieferantenverifizierung und Werksaudit vor Ort in China und Südostasien. Phase 1 umfasst fünf Länder: China, Vietnam, Thailand, Malaysia und die Philippinen. Weitere folgen, sobald wir die Auditorkapazität dort geprüft haben.",
        "fr": "Vérification des fournisseurs sur le terrain et audit d'usine en Chine et en Asie du Sud-Est. La phase 1 couvre cinq pays : Chine, Vietnam, Thaïlande, Malaisie et Philippines. D'autres sont ajoutés à mesure que nous y vérifions la capacité des auditeurs.",
        "pt": "Verificação de fornecedores no local e suporte de auditoria de fábrica na China e no Sudeste Asiático. A fase 1 abrange cinco países: China, Vietnã, Tailândia, Malásia e Filipinas. Mais são adicionados à medida que verificamos a capacidade dos auditores neles.",
        "ja": "中国および東南アジアでのサプライヤー核查と工場監査の現地支援。第1フェーズの対象は中国、ベトナム、タイ、マレーシア、フィリピンの5か国です。監査員の体制が確認できた国から順次追加します。",
        "ar": "التحقق من الموردين ميدانياً ودعم تدقيق المصانع في الصين وجنوب شرق آسيا. تغطي المرحلة الأولى خمسة بلدان: الصين وفيتنام وتايلاند وماليزيا والفلبين. ونضيف المزيد مع التحقق من قدرة المدققين فيها.",
    }),
    ("coverage.metaDesc", {
        "en": "Supplier verification and factory audit across China, Vietnam, Thailand, Malaysia and the Philippines. Country-specific sourcing risks, verification notes and audit considerations.",
        "zh": "覆盖中国、越南、泰国、马来西亚、菲律宾的供应商核查与工厂验厂服务。含各国采购风险、核查要点与验厂注意事项。",
        "zh-TW": "覆蓋中國、越南、泰國、馬來西亞、菲律賓的供應商查核與工廠驗廠服務。含各國採購風險、查核重點與驗廠注意事項。",
        "es": "Verificación de proveedores y auditoría de fábrica en China, Vietnam, Tailandia, Malasia y Filipinas. Riesgos de abastecimiento, notas de verificación y consideraciones de auditoría por país.",
        "de": "Lieferantenverifizierung und Werksaudit in China, Vietnam, Thailand, Malaysia und auf den Philippinen. Länderspezifische Beschaffungsrisiken, Verifizierungshinweise und Auditkriterien.",
        "fr": "Vérification de fournisseurs et audit d'usine en Chine, au Vietnam, en Thaïlande, en Malaisie et aux Philippines. Risques d'approvisionnement, notes de vérification et points d'audit par pays.",
        "pt": "Verificação de fornecedores e auditoria de fábrica na China, Vietnã, Tailândia, Malásia e Filipinas. Riscos de fornecimento, notas de verificação e critérios de auditoria por país.",
        "ja": "中国、ベトナム、タイ、マレーシア、フィリピンでのサプライヤー核查と工場監査。国ごとの調達リスク、核查のポイント、監査の注意点をまとめています。",
        "ar": "التحقق من الموردين وتدقيق المصانع في الصين وفيتنام وتايلاند وماليزيا والفلبين. مخاطر التوريد وملاحظات التحقق واعتبارات التدقيق لكل بلد.",
    }),
    ("servicesIndex.metaDesc", {
        "en": "Independent supplier verification, factory audit, inspection and sourcing support across China, Vietnam, Thailand, Malaysia and the Philippines. Scoped and quoted per project.",
        "zh": "覆盖中国、越南、泰国、马来西亚、菲律宾的独立供应商核查、工厂验厂、验货与采购支持。按项目确定范围并报价。",
        "zh-TW": "覆蓋中國、越南、泰國、馬來西亞、菲律賓的獨立供應商查核、工廠驗廠、驗貨與採購支援。按專案確定範圍並報價。",
        "es": "Verificación independiente de proveedores, auditoría de fábrica, inspección y soporte de abastecimiento en China, Vietnam, Tailandia, Malasia y Filipinas. Alcance y presupuesto por proyecto.",
        "de": "Unabhängige Lieferantenverifizierung, Werksaudit, Inspektion und Beschaffungsunterstützung in China, Vietnam, Thailand, Malaysia und auf den Philippinen. Umfang und Angebot pro Projekt.",
        "fr": "Vérification indépendante de fournisseurs, audit d'usine, inspection et appui au sourcing en Chine, au Vietnam, en Thaïlande, en Malaisie et aux Philippines. Périmètre et devis par projet.",
        "pt": "Verificação independente de fornecedores, auditoria de fábrica, inspeção e suporte de sourcing na China, Vietnã, Tailândia, Malásia e Filipinas. Escopo e orçamento por projeto.",
        "ja": "中国、ベトナム、タイ、マレーシア、フィリピンでの独立したサプライヤー核查、工場監査、検品、調達支援。案件ごとに範囲を決めて見積もります。",
        "ar": "تحقق مستقل من الموردين وتدقيق للمصانع وفحص ودعم للتوريد في الصين وفيتنام وتايلاند وماليزيا والفلبين. يُحدد النطاق ويُسعَّر لكل مشروع.",
    }),
    ("trust.scopeBody", {
        "en": "Supplier verification, factory audit, inspection and sourcing support for buyers importing from China and Southeast Asia. Phase 1 coverage is China, Vietnam, Thailand, Malaysia and the Philippines.",
        "zh": "为从中国及东南亚采购的买家提供供应商核查、工厂验厂、验货与采购支持。第一阶段覆盖中国、越南、泰国、马来西亚、菲律宾。",
        "zh-TW": "為從中國及東南亞採購的買家提供供應商查核、工廠驗廠、驗貨與採購支援。第一階段覆蓋中國、越南、泰國、馬來西亞、菲律賓。",
        "es": "Verificación de proveedores, auditoría de fábrica, inspección y apoyo de abastecimiento para compradores que importan de China y el Sudeste Asiático. La fase 1 cubre China, Vietnam, Tailandia, Malasia y Filipinas.",
        "de": "Lieferantenverifizierung, Werksaudit, Inspektion und Beschaffungsunterstützung für Käufer, die aus China und Südostasien importieren. Phase 1 umfasst China, Vietnam, Thailand, Malaysia und die Philippinen.",
        "fr": "Vérification de fournisseurs, audit d'usine, inspection et appui au sourcing pour les acheteurs qui importent de Chine et d'Asie du Sud-Est. La phase 1 couvre la Chine, le Vietnam, la Thaïlande, la Malaisie et les Philippines.",
        "pt": "Verificação de fornecedores, auditoria de fábrica, inspeção e suporte de sourcing para compradores que importam da China e do Sudeste Asiático. A fase 1 cobre China, Vietnã, Tailândia, Malásia e Filipinas.",
        "ja": "中国および東南アジアから輸入するバイヤー向けのサプライヤー核查、工場監査、検品、調達支援。第1フェーズの対象は中国、ベトナム、タイ、マレーシア、フィリピンです。",
        "ar": "التحقق من الموردين وتدقيق المصانع والفحص ودعم التوريد للمشترين المستوردين من الصين وجنوب شرق آسيا. تغطي المرحلة الأولى الصين وفيتنام وتايلاند وماليزيا والفلبين.",
    }),
]


def get_path(d, path):
    cur = d
    for part in path.split("."):
        cur = cur[part]
    return cur


def main():
    os.makedirs(BACKUP, exist_ok=True)
    total = 0
    for lang in LANGS:
        path = os.path.join("i18n", "dictionaries", f"{lang}.json")
        raw = io.open(path, encoding="utf-8", newline="").read()
        text = raw
        changed = False
        for dotpath, table in CHANGES:
            # 用 json 读出旧值，保证待替换串与文件里完全一致
            data = __import__("json").loads(text)
            old = get_path(data, dotpath)
            new = table[lang]
            needle = '"%s"' % old
            n = text.count(needle)
            if n != 1:
                print("[WARN] %s.%s 旧值命中 %d 次（期望 1），跳过" % (lang, dotpath, n))
                continue
            text = text.replace(needle, '"%s"' % new)
            total += 1
            changed = True
        if changed:
            shutil.copy2(path, os.path.join(BACKUP, f"{lang}.json"))
            io.open(path, "w", encoding="utf-8", newline="").write(text)
            print("[ok] %s 已更新" % lang)
        else:
            print("[skip] %s 无变化" % lang)
    print("共替换 %d 处" % total)


if __name__ == "__main__":
    main()
