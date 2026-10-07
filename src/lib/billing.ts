// ============================================================
// احتساب الأجر المالي للجلسة بالساعات — Focus Point.
//
// القاعدة المعتمدة (بدون تعديل إلا بطلب صريح):
//   - المدة بالدقائق = |check_in - check_out| (أي ترتيب، ولا قيمة سالبة).
//   - الساعات الكاملة = Math.floor(totalMinutes / 60).
//   - الدقائق الزائدة عن آخر ساعة كاملة:
//       ≤ 30  → تُهمل تماماً.
//       > 30  → تُضاف ساعة كاملة واحدة.
//   - الحد الأدنى = ساعة كاملة مهما كانت المدة (قرار صاحب المكان):
//       أي جلسة < 60 دقيقة تُحتسب ساعةً واحدة كحد أدنى.
//
// أمثلة متحقق منها (انظر scripts/billing-check.ts):
//   0:20 → 1 ساعة     = 10,000 ل.س
//   1:25 → 1 ساعة     = 10,000 ل.س
//   1:30 → 1 ساعة     = 10,000 ل.س
//   1:31 → ساعتان     = 20,000 ل.س
//   2:31 → 3 ساعات    = 30,000 ل.س
// ============================================================

/** السعر الافتراضي لسعر الساعة الواحدة (ليرة سورية) — يُستبدل من جدول settings عند الإنشاء. */
export const DEFAULT_HOURLY_RATE_SYP = 10000;

export type BillingResult = {
  /** المدة الإجمالية للجلسة بالدقائق (مقربة لأسفل). */
  totalMinutes: number;
  /** عدد الساعات المحتسبة للأجر (بعد التقريب وقواعد الحد الأدنى). */
  billableHours: number;
  /** المبلغ المحتسب = billableHours × hourlyRate. */
  amount: number;
};

export function computeBilling(
  checkIn: Date,
  checkOut: Date,
  hourlyRate: number
): BillingResult {
  const totalMinutes = Math.max(
    0,
    Math.floor((checkOut.getTime() - checkIn.getTime()) / 60_000)
  );

  const fullHours = Math.floor(totalMinutes / 60);
  // الدقائق الزائدة عن آخر ساعة كاملة.
  const extraMinutes = totalMinutes % 60;
  // التقريب: الزائد عن 30 دقيقة (وليس معها) → ساعة إضافية. ثم الحد الأدنى ساعة.
  const billableHours = Math.max(1, fullHours + (extraMinutes > 30 ? 1 : 0));

  const rate = Number.isFinite(hourlyRate) && hourlyRate > 0 ? hourlyRate : DEFAULT_HOURLY_RATE_SYP;
  const amount = billableHours * rate;

  return { totalMinutes, billableHours, amount };
}