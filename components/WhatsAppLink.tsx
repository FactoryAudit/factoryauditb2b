import Link from "next/link";

// WhatsApp 入口：号码来自环境变量 NEXT_PUBLIC_WHATSAPP_NUMBER（国际格式，不带 +，如 8613800138000）。
// 未配置时组件返回 null，避免出现点不动的死链。
const RAW = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

export function whatsappNumber(): string {
  return RAW.replace(/[^\d]/g, "");
}

export function whatsappConfigured(): boolean {
  return whatsappNumber().length >= 8;
}

export function whatsappUrl(message?: string): string {
  const n = whatsappNumber();
  if (!n) return "";
  return message
    ? `https://wa.me/${n}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${n}`;
}

export default function WhatsAppLink({
  label,
  message,
  className,
}: {
  label: string;
  message?: string;
  className?: string;
}) {
  const url = whatsappUrl(message);
  if (!url) return null;
  return (
    <Link href={url} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
    </Link>
  );
}
