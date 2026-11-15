"use client";

import { useState } from "react";
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import { whatsappUrl } from "@/components/WhatsAppLink";
import { contactConfigured } from "@/lib/contact";

// 品牌图标 path（WhatsApp 绿 #25D366 / 微信绿 #07C160）。品牌名与商标图形不属于
// 需翻译的文案，故与 SocialLinks / AccountMenu 一样以常量字面量内联，不做 9 语字典 key。
const WHATSAPP_PATH =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";
const WECHAT_PATH =
  "M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.032zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z";

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
  /** aria-label：关闭按钮 */
  close: string;
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

  // 直接联系入口：WhatsApp 走 wa.me（未配置号码则不渲染）；微信跳站内 /contact#wechat 扫码。
  const waHref = whatsappUrl("Hi FactoryAuditB2B, I have a question.");
  const wechatHref = `${localePath(locale, "/contact")}#wechat`;
  // 品牌名本地化：微信在中文站显示「微信」，其余语言用国际通用名 WeChat。
  const wechatName = locale === "zh" || locale === "zh-TW" ? "微信" : "WeChat";

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
        <div className={`fixed bottom-6 ${side} z-50 flex flex-col items-center gap-3`}>
          {contactConfigured() && (
            <Link
              href={wechatHref}
              aria-label={wechatName}
              title={wechatName}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#07C160] text-white shadow-lg transition hover:bg-[#06AD56]"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
                <path d={WECHAT_PATH} />
              </svg>
            </Link>
          )}
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={whatsappLabel ?? "WhatsApp"}
              title={whatsappLabel ?? "WhatsApp"}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:bg-[#1DA851]"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
                <path d={WHATSAPP_PATH} />
              </svg>
            </a>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={dict.title}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#171717] text-white shadow-lg hover:bg-[#0d3f6b]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      )}

      {open && (
        <div
          className={`fixed bottom-6 ${side} z-50 flex h-[30rem] w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-lg border border-[#ebe8e1] bg-white shadow-xl`}
        >
          <div className="flex items-center justify-between bg-[#171717] px-4 py-3 text-white">
            <div>
              <div className="text-sm font-medium">{dict.title}</div>
              <div className="text-[11px] text-white/80">{dict.subtitle}</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={dict.close} className="text-white/90 hover:text-white">
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
                    m.role === "user" ? "bg-[#171717] text-white" : "bg-[#f5f3ee] text-[#171717]"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-[#f5f3ee] px-3 py-2 text-sm text-[#6d6b66]">{dict.thinking}</div>
              </div>
            )}
            {messages.length === 1 && !loading && (
              <div className="space-y-2 pt-1">
                {dict.quickQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="block w-full rounded border border-[#ebe8e1] px-3 py-2 text-start text-xs text-[#171717] hover:bg-[#f5f3ee]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#ebe8e1] p-3">
            <div className="mb-2 flex items-center gap-2">
              {waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={whatsappLabel ?? "WhatsApp"}
                  title={whatsappLabel ?? "WhatsApp"}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[#25D366]/40 bg-[#25D366]/10 px-2 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#25D366]/20"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                    <path d={WHATSAPP_PATH} />
                  </svg>
                  WhatsApp
                </a>
              )}
              {contactConfigured() && (
                <Link
                  href={wechatHref}
                  aria-label={wechatName}
                  title={wechatName}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[#07C160]/40 bg-[#07C160]/10 px-2 py-2 text-xs font-semibold text-[#05944A] transition hover:bg-[#07C160]/20"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                    <path d={WECHAT_PATH} />
                  </svg>
                  {wechatName}
                </Link>
              )}
            </div>
            <div className="mb-2 text-[11px] text-[#6d6b66]">
              {dict.ctaText}{" "}
              <Link href={localePath(locale, "/custom-services")} className="text-[#171717] underline">
                {dict.ctaButton}
              </Link>
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
