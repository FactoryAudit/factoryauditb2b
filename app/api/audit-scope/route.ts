import { NextRequest, NextResponse } from "next/server";
import {
  AUDIT_TYPES,
  recommendAuditScope,
  type OrderValueBand,
  type ProductRisk,
} from "@/lib/auditScope";
import { aiScopeNarrative } from "@/lib/ai";

const ORDER_VALUES: OrderValueBand[] = ["lt10k", "10to50k", "50to200k", "gt200k"];
const PRODUCT_RISKS: ProductRisk[] = ["low", "medium", "high"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const riskScore = Number(body.riskScore);
    if (!Number.isFinite(riskScore)) {
      return NextResponse.json({ error: "invalid riskScore" }, { status: 400 });
    }

    const firstOrder = body.firstOrder !== false; // 缺省视为首单，与前端默认一致
    const orderValue = ORDER_VALUES.includes(body.orderValue) ? body.orderValue : "10to50k";
    const productRisk = PRODUCT_RISKS.includes(body.productRisk) ? body.productRisk : "low";
    const weakDimensions = Array.isArray(body.weakDimensions)
      ? body.weakDimensions.filter((x: unknown) => typeof x === "string")
      : [];

    // 决策完全由纯规则引擎给出，AI 只负责叙述段（无 key 时为空串，source=rule）
    const rec = recommendAuditScope({
      riskScore: Math.max(0, Math.min(100, riskScore)),
      firstOrder,
      orderValue,
      productRisk,
      weakDimensions,
    });

    const { text, source } = await aiScopeNarrative({
      locale: String(body.locale ?? "en"),
      band: rec.band,
      auditType: AUDIT_TYPES[rec.auditTypeIndex],
      manDays: rec.manDays,
      modules: rec.modules.map((m) => m.key),
      reasons: rec.reasons,
    });

    return NextResponse.json({
      ok: true,
      band: rec.band,
      auditTypeIndex: rec.auditTypeIndex,
      manDays: rec.manDays,
      modules: rec.modules.map((m) => ({ key: m.key, reasons: m.reasons })),
      reasons: rec.reasons,
      narrative: text,
      source,
    });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
