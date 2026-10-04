-- ============================================================
-- StudyZone - assign_random_spot function + seed spots
-- ============================================================
-- ------------------------------------------------------------
-- assign_random_spot(spot_type text, p_student_id uuid)
-- ------------------------------------------------------------
-- Allocates a random available spot of the given type for a
-- student within a single transaction:
--   - picks one available spot (type match, not occupied)
--   - uses FOR UPDATE SKIP LOCKED to prevent double-allocation
--   - if none available, returns NULL
--   - if found, marks it occupied and creates an active session,
--     then returns session_id + the assigned spot (id & label)
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
  -- Pick a single available spot, locking it to prevent
  -- concurrent transactions from picking the same row.
  select s.id, s.label
    into v_spot
    from public.spots s
   where s.type = spot_type
     and s.is_occupied = false
   order by random()
   limit 1
     for update skip locked;

  -- If no available spot was found, return NULL (no exception).
  if v_spot.id is null then
    return null;
  end if;

  -- Mark the spot as occupied.
  update public.spots
     set is_occupied = true
   where id = v_spot.id;

  -- Create an active session for the student on this spot.
  insert into public.sessions (student_id, spot_id, status)
  values (p_student_id, v_spot.id, 'active')
  returning id into v_session_id;

  -- Return session_id along with the assigned spot details.
  return json_build_object(
    'session_id', v_session_id,
    'spot_id', v_spot.id,
    'spot_label', v_spot.label
  );
end;
$$;

-- Grant execute to authenticated roles is not needed locally:
-- the app connects directly via the `pg` pool as the postgres role.

-- ------------------------------------------------------------
-- Seed data: 5 study tables and 3 art studios
-- ------------------------------------------------------------
insert into public.spots (type, label) values
  ('table',  'طاولة 1'),
  ('table',  'طاولة 2'),
  ('table',  'طاولة 3'),
  ('table',  'طاولة 4'),
  ('table',  'طاولة 5'),
  ('studio', 'مرسم 1'),
  ('studio', 'مرسم 2'),
  ('studio', 'مرسم 3');
