-- توسيع قيم حالة الطلب لتشمل 'cancelled' (إلغاء تلقائي عند إنهاء الجلسة)
-- قبل: ('pending','done') → بعد: ('pending','done','cancelled')

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('pending','done','cancelled'));