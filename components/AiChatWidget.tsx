"use client";

import { useState } from "react";
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import WhatsAppLink from "@/components/WhatsAppLink";

export type AiChatDict = {
  title: string;
  subtitle: string;
  greeting: string;
  placeholder: string;
  send: string;
  quickQuestions: string[];
  thinking: string;
  error: string;
  ctaText: string;
  ctaButton: string;
};

type Msg = { role: "user" | "assistant"; content: string };

export default function AiChatWidget({
  locale,
  dict,
  whatsappLabel,
}: {
  locale: Locale;
  dict: AiChatDict;
  whatsappLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: dict.greeting }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const isRtl = locale === "ar";
  const side = isRtl ? "left-6" : "right-6";

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-6), locale }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply || dict.error }]);
    } catch {
      setMessages([...next, { role: "assistant", content: dict.error }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={dict.title}
          className={`fixed bottom-6 ${side} z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#0f4c81] text-white shadow-lg hover:bg-[#0d3f6b]`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {open && (
        <div
          className={`fixed bottom-6 ${side} z-50 flex h-[30rem] w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-xl`}
        >
          <div className="flex items-center justify-between bg-[#0f4c81] px-4 py-3 text-white">
            <div>
              <div className="text-sm font-medium">{dict.title}</div>
              <div className="text-[11px] text-white/80">{dict.subtitle}</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-white/90 hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-[#0f4c81] text-white" : "bg-[#f1f5f9] text-[#0f172a]"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-[#f1f5f9] px-3 py-2 text-sm text-[#64748b]">{dict.thinking}</div>
              </div>
            )}
            {messages.length === 1 && !loading && (
              <div className="space-y-2 pt-1">
                {dict.quickQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="block w-full rounded border border-[#e2e8f0] px-3 py-2 text-start text-xs text-[#0f4c81] hover:bg-[#f1f5f9]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#e2e8f0] p-3">
            <div className="mb-2 text-[11px] text-[#64748b]">
              {dict.ctaText}{" "}
              <Link href={localePath(locale, "/custom-services")} className="text-[#0f4c81] underline">
                {dict.ctaButton}
              </Link>
              {whatsappLabel && (
                <>
                  {" · "}
                  <WhatsAppLink
                    label={whatsappLabel}
                    message="Hi FactoryAuditB2B, I have a question."
                    className="text-[#0f4c81] underline"
                  />
                </>
              )}
            </div>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send(input);
                }}
                placeholder={dict.placeholder}
                maxLength={500}
              />
              <button
                type="button"
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                className="btn btn-primary px-3 text-sm disabled:opacity-50"
              >
                {dict.send}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
