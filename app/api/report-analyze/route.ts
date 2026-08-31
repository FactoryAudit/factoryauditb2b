import { NextRequest, NextResponse } from "next/server";
import { aiReportReview } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const report = String(body.report ?? "");
    const { score, issues, source } = await aiReportReview(report);
    return NextResponse.json({ score, issues, source });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
