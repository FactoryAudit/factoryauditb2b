import { NextRequest, NextResponse } from "next/server";
import { aiRisk } from "@/lib/ai";
import type { RiskInput } from "@/lib/scoring";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RiskInput;
    const { result, source } = await aiRisk(body);
    return NextResponse.json({ result, source });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
