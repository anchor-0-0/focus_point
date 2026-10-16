-- ============================================================
-- قسم قاعة التدريب — توثيق الدورات (إدخال يدوي، عرض فقط)
-- مستقل تماماً عن إيرادات الجلسات/التقارير/سجل الجلسات.
-- ============================================================

-- CreateTable
CREATE TABLE "training_courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "trainer" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "days" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "students_count" INTEGER NOT NULL,
    "sessions_count" INTEGER NOT NULL,
    "total_cost" DECIMAL(12,2) NOT NULL,
    "cost_per_student" DECIMAL(12,2) NOT NULL,
    "center_share_percent" DECIMAL(5,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "training_courses_code_key" ON "training_courses"("code");

-- CHECK constraints — سلامة البيانات فقط (دون تعديل أي قيمة مدخلة).
alter table public.training_courses
  add constraint training_courses_students_count_check
  check (students_count >= 0);

alter table public.training_courses
  add constraint training_courses_sessions_count_check
  check (sessions_count >= 0);

alter table public.training_courses
  add constraint training_courses_total_cost_check
  check (total_cost >= 0);

alter table public.training_courses
  add constraint training_courses_cost_per_student_check
  check (cost_per_student >= 0);

alter table public.training_courses
  add constraint training_courses_center_share_check
  check (center_share_percent >= 0 and center_share_percent <= 100);

alter table public.training_courses
  add constraint training_courses_dates_check
  check (end_date >= start_date);

alter table public.training_courses
  add constraint training_courses_days_check
  check (days <@ array['sat','sun','mon','tue','wed','thu','fri']::text[]);
