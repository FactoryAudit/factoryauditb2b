// JSON-LD 结构化数据注入（SEO / AI 理解）。data 为受控对象（来自引擎，非用户输入），安全。
export default function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      // 内容为内部结构化对象，非用户输入，序列化安全
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
