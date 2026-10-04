-- ============================================================
-- StudyZone - Initial Schema
-- Tables: students, spots, sessions, services, orders
-- ============================================================

-- ------------------------------------------------------------
-- students
-- ------------------------------------------------------------
create table public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- spots
-- ------------------------------------------------------------
create table public.spots (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('table', 'studio')),
  label text,
  is_occupied boolean default false
);

-- ------------------------------------------------------------
-- sessions
-- ------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id),
  spot_id uuid references public.spots(id),
  check_in timestamptz default now(),
  check_out timestamptz,
  status text default 'active' check (status in ('active', 'ended'))
);

-- ------------------------------------------------------------
-- services
-- ------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text
);

-- ------------------------------------------------------------
-- orders
-- ------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id),
  service_id uuid references public.services(id),
  status text default 'pending' check (status in ('pending', 'done')),
  details jsonb,
  created_at timestamptz default now()
);
