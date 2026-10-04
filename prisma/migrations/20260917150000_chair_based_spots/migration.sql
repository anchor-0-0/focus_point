-- ============================================================
-- تحويل نظام الحجز من "طاولة/مرسم" إلى "كراسي داخل قاعات":
--   - جدول spots أصبح يحمل كرسي فعلي واحد لكل صف
--     (room + group_label + seat_number + is_occupied)
--   - يُحذف الجدول القديم ويعاد بناؤه (لا بيانات حجز حرجة في
--     هذه المرحلة — نُطهّر الطلبات والجلسات أولاً لتمرير الـ FK)
--   - تُستبدل دالة التخصيص بـ assign_random_chair(p_room, p_student_id)
-- ============================================================

-- 1) تطهير البيانات القديمة (يوافق تقييد الـ FK عند إعادة البناء)
delete from public.orders;
delete from public.sessions;

-- 2) سقوط المقيّد التابع أولاً ثم إسقاط الجدول القديم
alter table public.sessions drop constraint sessions_spot_id_fkey;
drop table public.spots;

create table public.spots (
    id           uuid      not null default gen_random_uuid(),
    room         text      not null,
    group_label  text      not null,
    seat_number  integer   not null,
    is_occupied  boolean   not null default false,

    constraint spots_pkey primary key (id),
    constraint spots_room_check check (room in ('social', 'silent', 'smoking')),
    constraint spots_seat_pos_check check (seat_number > 0)
);

-- 3) إعادة ربط الجلسات بالجدول الجديد
-- (المقيّد السابق حُذف تلقائياً مع الجدول القديم)
alter table public.sessions
    add constraint sessions_spot_id_fkey
    foreign key (spot_id) references public.spots(id)
    on delete restrict on update cascade;

-- 4) إزالة الدالة القديمة واستبدالها بنسخة الكراسي
drop function if exists public.assign_random_spot(text, uuid);

create or replace function public.assign_random_chair(
    p_room text,
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
    select c.id, c.group_label, c.seat_number
      into v_chair
      from public.spots c
     where c.room = p_room
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
        'room',         p_room,
        'group_label',  v_chair.group_label,
        'seat_number',  v_chair.seat_number
    );
end;
$$;