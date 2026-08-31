import { NextRequest, NextResponse } from "next/server";
import { aiRfqDraft } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, source } = await aiRfqDraft({
      product: String(body.product ?? ""),
      quantity: String(body.quantity ?? ""),
      market: String(body.market ?? ""),
      spec: String(body.spec ?? "")
    });
    return NextResponse.json({ text, source });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
