-- =============================================================================
-- FactoryAuditB2B V2.1 — 005 证据文件存储（Supabase Storage 私有 bucket）
-- 创建日期：2026-09-10
--
-- 设计约束：
--   1. bucket 必须私有（public = false）。原始审核报告/证书扫描件永不公开 URL。
--   2. 读写一律走服务端 service_role（绕过 RLS）。不建任何 storage.objects
--      policy —— 无 policy 即默认拒绝 anon/authenticated，这是有意的。
--   3. 文件大小上限 10MB、MIME 白名单 pdf/jpeg/png，与 supplier_documents
--      的 CHECK 约束保持一致。
--   4. 对象命名：{supplier_id}/{document_type}/{yyyy-mm}/{uuid}-{filename}
--      带前缀的目的：① 便于按供应商批量导出/删除；② 防止路径穿越。
--
-- 执行位置：Supabase Dashboard → SQL Editor（DDL/管理操作无法经 PostgREST 执行）
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-docs',
  'supplier-docs',
  false,          -- 私有：不生成公开 URL
  10485760,       -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 自检：确认 bucket 已建且为私有
DO $$
DECLARE
  v_public boolean;
BEGIN
  SELECT public INTO v_public FROM storage.buckets WHERE id = 'supplier-docs';
  IF v_public IS NULL THEN
    RAISE EXCEPTION '[005] bucket supplier-docs 未创建成功';
  END IF;
  IF v_public THEN
    RAISE EXCEPTION '[005] bucket supplier-docs 必须是私有（public=false），当前为公开';
  END IF;
  RAISE NOTICE '[005] OK：bucket supplier-docs 已就绪且为私有';
END $$;

-- =============================================================================
-- 完成。下一步：跑 scripts/check-v21-config.mjs 自检（应显示 storage bucket 存在）。
-- =============================================================================
