// ============================================================
// تحليل الأعداد الصحيحة المدخلة يدوياً (خادوم + عميل).
// ------------------------------------------------------------
// يقبل:
//   - الأرقام الإنجليزية (0-9).
//   - الأرقام العربية-الهندية (٠-٩ = U+0660..U+0669).
//   - الأرقام الفارسية/الأردوية (۰-۹ = U+06F0..U+06F9).
//   - فواصل الآلاف والمسافات: ',' و '٬'(U+066C) و '،'(U+060C)
//     و '٭'(U+066B) والمسافات العادية/غير الفاصلة.
// يرفض أي نص غير رقمي (حروف، رموز، إشارة سالبة، نقطة عشرية) بإرجاع null.
// لا يُقرّب ولا يُغيّر القيمة إطلاقاً.
// ============================================================

const AR_DIGITS = /[\u0660-\u0669]/g;
const FA_DIGITS = /[\u06f0-\u06f9]/g;
const SEPARATORS = /[,\u066b\u066c\u060c\u00a0\u2009\u202f\s]/g;

/** يحوّل الأرقام العربية-الهندية/الفارسية إلى نظيرها الإنجليزي. */
export function normalizeDigits(input: string): string {
  return input
    .replace(AR_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(FA_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * يحوّل قيمة (رقم أو نص بأرقام إنجليزية/عربية مع فواصل) إلى عدد صحيح
 * موجب آمن، أو null إن كانت غير صالحة. لا تقريب: الكسور تُرفض.
 */
export function parsePositiveInt(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isSafeInteger(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw !== "string") return null;

  const digits = normalizeDigits(raw.trim()).replace(SEPARATORS, "");
  if (!/^\d+$/.test(digits)) return null;

  const n = Number(digits);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
