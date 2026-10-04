-- ============================================================
-- التخصيص الأدق داخل القاعات: عمود seat_group + تحديث دالة التخصيص
-- ------------------------------------------------------------
-- seat_group يحمل مجموعة التخصيص الفعلية لكل كرسي:
--   'social_table'   : كل كراسي Social
--   'silent_writing' : طاولتا الكتابة الكبيرتان في Silent (8 كراسي)
--   'silent_bar'     : البار الدراسي في Silent (6 كراسي)
--   'smoking_bar'    : كل كراسي Smoking
-- الدالة assign_random_chair أصبحت تأخذ p_seat_group (بدل p_room)
-- ليتوحّد منطق التخصيص لكل القاعات.
-- ============================================================

-- 1) إضافة العمود (قابل null في البداية ثم نملأه)
alter table public.spots add column seat_group text;

-- 2) تعبئة القيمة من room و group_label
update public.spots
   set seat_group = case
         when room = 'social'
              then 'social_table'
         when room = 'silent' and group_label like 'Silent - Writing%'
              then 'silent_writing'
         when room = 'silent' and group_label like 'Silent - Study Bar%'
              then 'silent_bar'
         when room = 'smoking'
              then 'smoking_bar'
         else null
       end;

-- 3) قيود الصحة: القيم المسموحة + عدم السماح بفراغ
alter table public.spots alter column seat_group set not null;
alter table public.spots
    add constraint spots_seat_group_check
    check (seat_group in ('social_table', 'silent_writing', 'silent_bar', 'smoking_bar'));

-- 4) استبدال دالة التخصيص لتعمل على seat_group
drop function if exists public.assign_random_chair(text, uuid);

create or replace function public.assign_random_chair(
    p_seat_group text,
    p_student_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    v_chair record;
    v_session_id uuid;
begin
    select c.id, c.group_label, c.seat_number, c.room
      into v_chair
      from public.spots c
     where c.seat_group = p_seat_group
       and c.is_occupied = false
     order by random()
     limit 1
       for update skip locked;

    if v_chair.id is null then
        return null;
    end if;

    update public.spots
       set is_occupied = true
     where id = v_chair.id;

    insert into public.sessions (student_id, spot_id, status)
    values (p_student_id, v_chair.id, 'active')
    returning id into v_session_id;

    return json_build_object(
        'session_id',   v_session_id,
        'spot_id',      v_chair.id,
        'room',         v_chair.room,
        'seat_group',   p_seat_group,
        'group_label',  v_chair.group_label,
        'seat_number',  v_chair.seat_number
    );
end;
$$;