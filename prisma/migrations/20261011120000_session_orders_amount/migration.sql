-- AlterTable: لقطة حصة الخدمات (done) من فاتورة الجلسة لحظة الإنهاء.
-- تُقرأ الإيرادات حصراً من لقطات الجلسات المنتهية (session_amount +
-- orders_amount − discount_amount = final_amount)؛ لا تُقرأ من جدول orders.
ALTER TABLE "sessions" ADD COLUMN "orders_amount" DECIMAL(12,2);
