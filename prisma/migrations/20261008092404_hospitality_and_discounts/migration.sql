-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "discount_amount" DECIMAL(12,2),
ADD COLUMN     "discount_note" TEXT,
ADD COLUMN     "discount_scope" TEXT,
ADD COLUMN     "discount_type" TEXT,
ADD COLUMN     "discount_value" DECIMAL(12,2),
ADD COLUMN     "final_amount" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "hospitality_recipients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'guest',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hospitality_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospitality_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service_id" UUID NOT NULL,
    "recipient_type" TEXT NOT NULL DEFAULT 'guest',
    "recipient_id" UUID,
    "guest_label" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "guests_count" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "unit_price_snapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hospitality_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "hospitality_logs" ADD CONSTRAINT "hospitality_logs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitality_logs" ADD CONSTRAINT "hospitality_logs_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "hospitality_recipients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK constraints (الضيافة والخصم) — على نسق بقية قيود المشروع.
alter table public.sessions
  add constraint sessions_discount_scope_check
  check (discount_scope is null or discount_scope in ('total', 'hours', 'orders'));

alter table public.sessions
  add constraint sessions_discount_type_check
  check (discount_type is null or discount_type in ('percent', 'fixed', 'free_hours'));

alter table public.hospitality_recipients
  add constraint hospitality_recipients_type_check
  check (type in ('guest', 'management'));

alter table public.hospitality_logs
  add constraint hospitality_logs_recipient_type_check
  check (recipient_type in ('guest', 'management'));

alter table public.hospitality_logs
  add constraint hospitality_logs_quantity_check
  check (quantity > 0);

alter table public.hospitality_logs
  add constraint hospitality_logs_guests_count_check
  check (guests_count > 0);
