import { NextResponse } from "next/server";
import { z } from "zod";
import { aiChat, type ChatMessage } from "@/lib/ai";
import { getDictionary } from "@/i18n/getDictionary";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/i18n/config";

// 输入校验：限制条数与长度，避免超长输入推高 API 成本
const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(800),
      })
    )
    .min(1)
    .max(10),
  locale: z.string().optional(),
});

// 未配置 DEEPSEEK_API_KEY（或调用失败）时的兜底：按关键词命中本地化 FAQ
const TOPIC_KEYWORDS: Record<string, string[]> = {
  // 关键词需同时覆盖简体与繁体（zh-TW 由 zh 派生，用户输入是繁体），
  // 并包含常见动词变位（德语 kostet、葡语 custa），否则会误落到 default 兜底。
  pricing: [
    "price", "pricing", "cost", "costs", "how much", "fee", "plan", "subscription", "quote",
    "价格", "價格", "多少钱", "多少錢", "收费", "收費", "费用", "費用", "方案", "报价", "報價",
    "料金", "費用", "いくら", "値段",
    "precio", "costo", "cuesta", "cuánto", "cuanto", "tarifa",
    "preis", "kosten", "kostet", "wie viel", "wieviel", "gebühr",
    "prix", "coût", "cout", "coûte", "tarif", "tarifs",
    "preço", "custo", "custa", "valor", "taxa",
    "السعر", "سعر", "التكلفة", "تكلفة", "كم", "رسوم",
  ],
  audit: [
    "audit", "audits", "smeta", "bsci", "iso", "certification", "certificate", "verify", "verification",
    "inspection", "inspect", "compliance",
    "审核", "審核", "验厂", "驗廠", "认证", "認證", "检验", "檢驗", "验货", "驗貨", "合规", "合規", "验证", "驗證",
    "監査", "検査", "認証", "検証", "審査",
    "auditoría", "auditoria", "inspección", "inspeccion", "certificación", "certificacion", "verificación",
    "prüfung", "inspektion", "zertifizierung", "konformität",
    "تدقيق", "تفتيش", "شهادة", "امتثال",
  ],
  coverage: [
    "country", "countries", "china", "vietnam", "india", "thailand", "malaysia", "indonesia", "cambodia",
    "mexico", "region", "coverage", "cover",
    "国家", "國家", "覆盖", "覆蓋", "地区", "地區", "哪些国家", "哪些國家",
    "対応国", "対応", "地域", "国",
    "país", "pais", "países", "cobertura", "región",
    "land", "länder", "abdeckung", "region",
    "pays", "couverture", "région",
    "cobertura", "região",
    "بلد", "دولة", "دول", "تغطية", "منطقة",
  ],
  training: [
    "training", "train", "course", "workshop", "coach", "educate",
    "培训", "培訓", "训练", "訓練", "课程", "課程", "上课", "上課",
    "研修", "トレーニング", "教育", "訓練",
    "formación", "formacion", "capacitación", "capacitacion", "curso",
    "schulung", "kurs", "schulen",
    "formation", "cours", "former",
    "treinamento", "curso", "capacitação", "treinar",
    "تدريب", "دورة", "تدريبية",
  ],
};

function detectTopic(text: string): string {
  const lower = text.toLowerCase();
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k.trim()))) return topic;
  }
  return "default";
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { messages, locale: rawLocale } = bodySchema.parse(json);
    const locale: Locale = isLocale(rawLocale ?? "") ? (rawLocale as Locale) : DEFAULT_LOCALE;

    // 优先走 DeepSeek；未配置或失败时返回空，由下面兜底
    const { reply, source } = await aiChat({ messages: messages as ChatMessage[], locale });
    if (source === "ai" && reply) {
      return NextResponse.json({ reply, source: "ai" });
    }

    // 兜底：本地化 FAQ（保证客服在任何情况下都能回应，不阻塞转化）
    const t = await getDictionary(locale);
    const topic = detectTopic(messages[messages.length - 1].content);
    const answers = t.aiChat.fallbackAnswers as unknown as Record<string, string>;
    return NextResponse.json({
      reply: answers[topic] ?? answers.default,
      source: "local",
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
