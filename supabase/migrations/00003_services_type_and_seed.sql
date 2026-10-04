-- ============================================================
-- StudyZone - services: type discriminator + per-service items + seed
-- ============================================================
-- يضيف لجدول services:
--   - type:  يميّز شكل نموذج التخصيص التابع لكل خدمة
--            ('print' = طباعة: عدد صفحات + ملاحظة)
--            ('item'  = بوفيه/مشروبات: صنف + كمية)
--   - items: قائمة الأصناف الثابتة الخاصة بكل خدمة (jsonb array of text)
--            تُستخدم كخيارات "الصنف" في نموذج طلب خدمات type='item'.
-- ثم يضيف خدمات تجريبية (seed) — لا تُدرج إلا إذا كان الجدول فارغاً
-- حتى لا تتكرر عند إعادة التشغيل.
-- ============================================================

alter table public.services
  add column type text not null default 'item'
    check (type in ('print', 'item')),
  add column items jsonb not null default '[]'::jsonb;

insert into public.services (name, category, type, items)
select * from (values
  ('طباعة أبيض وأسود', 'طباعة',    'print', '[]'::jsonb),
  ('طباعة ملونة',      'طباعة',    'print', '[]'::jsonb),
  ('قهوة',             'مشروبات',  'item',  '["قهوة تركية", "قهوة أمريكية", "نسكافيه"]'::jsonb),
  ('شاي',              'مشروبات',  'item',  '["شاي أحمر", "شاي أخضر"]'::jsonb),
  ('مياه',             'مشروبات',  'item',  '["صغير", "كبير"]'::jsonb)
) as v (name, category, type, items)
where not exists (select 1 from public.services);