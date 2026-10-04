-- ============================================================
-- إضافات تشغيلية لا يمثلها Prisma schema مباشرة:
--   1) CHECK constraints (المقيّدات) على الأعمدة المقيّدة
--   2) دالة assign_random_spot (تخصيص مكان عشوائي متاح بأمان
--      ضد التزامن عبر FOR UPDATE SKIP LOCKED)
--
-- req: هذه السكربت idempotent (يمكن تشغيله أكثر من مرة بأمان)
-- ============================================================

-- ------------------------------------------------------------
-- 1) CHECK constraints
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'spots_type_check') then
    alter table public.spots add constraint spots_type_check check (type in ('table','studio'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sessions_status_check') then
    alter table public.sessions add constraint sessions_status_check check (status in ('active','ended'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_status_check') then
    alter table public.orders add constraint orders_status_check check (status in ('pending','done'));
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 2) assign_random_spot(spot_type text, p_student_id uuid)
-- ------------------------------------------------------------
-- يخصّص مكاناً متاحاً عشوائياً من النوع المطلوب داخل معاملة واحدة:
--   - يختار مكاناً متاحاً (نوع مطابق + غير مشغول)
--   - قفل FOR UPDATE SKIP LOCKED يمنع التخصيص المزدوج
--   - إذا لم يوجد مكان، يُعيد NULL (بلا استثناء)
--   - عند وجوده: يشغّله وينشئ جلسة نشطة ويُعيد session_id + تفاصيل المكان
-- ------------------------------------------------------------
create or replace function public.assign_random_spot(
  spot_type text,
  p_student_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spot record;
  v_session_id uuid;
begin
  select s.id, s.label
    into v_spot
    from public.spots s
   where s.type = spot_type
     and s.is_occupied = false
   order by random()
   limit 1
     for update skip locked;

  if v_spot.id is null then
    return null;
  end if;

  update public.spots
     set is_occupied = true
   where id = v_spot.id;

  insert into public.sessions (student_id, spot_id, status)
  values (p_student_id, v_spot.id, 'active')
  returning id into v_session_id;

  return json_build_object(
    'session_id', v_session_id,
    'spot_id', v_spot.id,
    'spot_label', v_spot.label
  );
end;
$$;