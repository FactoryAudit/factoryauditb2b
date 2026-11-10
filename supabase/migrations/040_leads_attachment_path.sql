-- 040_leads_attachment_path.sql
--
-- 背景（2026-11-10）：
--   /careers 审核员申请已经把简历附件发进管理员邮箱，但**后台看不到文件本体** ——
--   leads.payload 里只有一个 cvFilename 字符串，点不开、下载不了。
--   「申请人说注册了，后台什么都看不到」的直接原因之一就是这个。
--
-- 方案：
--   leads 增加 attachment_path，存 Supabase Storage 私有 bucket 内的对象路径
--   （supplier-docs/careers/{yyyy-mm}/{uuid}-{safeName}）。
--   后台按需生成短时签名 URL 下载，不生成公开 URL。
--
-- 语义：
--   NULL = 未上传附件（/careers 的简历是选填，NULL 是正常态，不是异常）。
--   与 payload 里的 cvFilename 并存：payload 是原始提交快照，本列是可下载对象。

alter table public.leads
  add column if not exists attachment_path text;

comment on column public.leads.attachment_path is
  'Storage 对象路径（私有 bucket）；NULL 表示该线索没有附件。后台用签名 URL 下载，不暴露公开链接。';

-- 只有极少数行有值，部分索引足够，避免全表膨胀
create index if not exists leads_attachment_path_idx
  on public.leads (created_at desc)
  where attachment_path is not null;
