// ============================================================
// تنسيق موحّد للمدد الزمنية (بلا اعتماد على مكوّنات React).
// يُستعمل في الخادوم والعميل: ملخص الجلسات، سجل المنتهية، التقارير.
// ============================================================

/** "1 س 31 د" — باختصار العربية: س/د. اختيار الاختصار مسؤولية المتصل. */
export function durationHM(
  ms: number,
  hourShort: string,
  minuteShort: string
): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0 && minutes === 0) return `0 ${minuteShort}`;
  if (hours === 0) return `${minutes} ${minuteShort}`;
  if (minutes === 0) return `${hours} ${hourShort}`;
  return `${hours} ${hourShort} ${minutes} ${minuteShort}`;
}

/** "ساعة:دقيقة" لصفوف الجداول العريضة (تجنّب النص الطويل). */
export function durationColon(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}`;
}

/** مقطع اختصار الساعة/الدقيقة حسب اللغة. */
export function hourMinuteShort(lang: "ar" | "en"): {
  h: string;
  m: string;
} {
  return lang === "en" ? { h: "h", m: "m" } : { h: "س", m: "د" };
}