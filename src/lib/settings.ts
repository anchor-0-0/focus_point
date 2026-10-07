// ============================================================
// قراءة سعر الساعة من جدول الإعدادات (settings).
// يُمرَّر كائن قاعدة بيانات (العميل الأساسي أو الكائن داخل transaction)
// حتى تتم القراءة داخل نفس الـ transaction حيث لا يتوفر المصدر الخارجي.
//
// يبقى السعر الافتراضي (DEFAULT_HOURLY_RATE_SYP) احتياطاً إن غاب
// الصف (ترحيل حديث أو مسح يدوي) — وجدول settings يملؤه الـ seed.
// ============================================================

import { DEFAULT_HOURLY_RATE_SYP } from "./billing";

export const HOURLY_RATE_KEY = "hourly_rate_syp";

/** الشكل البنيوي لقراءة الإعدادات (يعمل مع العميل العادي ومع tx الداخلي). */
export type RateDb = {
  setting: {
    findUnique(args: { where: { key: string } }): Promise<{ value: string } | null>;
  };
};

/** سعر الساعة الحالي بالليرة السورية (عدد صحيح موجب). */
export async function readHourlyRate(db: RateDb): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: HOURLY_RATE_KEY } });
  const n = Number(row?.value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_HOURLY_RATE_SYP;
}