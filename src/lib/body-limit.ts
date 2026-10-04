// ============================================================
// حد مبكر لحجم الجسم قبل فكّ ترميزه (A7)
// ------------------------------------------------------------
// request.formData() / request.json() يوزّعان الجسم كاملاً في
// الذاكرة قبل أن تتحقق أيدينا من الحدود. فحص Content-Length مسبقاً
// يرفض الطلب الكبير (413) قبل أي معالجة. حين لا يصحب الطلب عنوان
// Content-Length (نقل chunked نادر) نمرر ونعتمد على حدود الحقول
// نفسها (سقف 20MB لكل ملف في saveUploadedFile).
// ============================================================

import { NextResponse } from "next/server";

export const MAX_JSON_BODY_BYTES = 256 * 1024; // 256KB للطلبات JSON
export const MAX_PRINT_BODY_BYTES = 26 * 1024 * 1024; // 20MB ملف + حمولة multipart

/** حجم الجسم المُعلَن عبر Content-Length، أو null عند غيابه. */
export function declaredBodyLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * فحص مبكر: يعيد استجابة 413 جاهزة إن تجاوز الحجم المُعلَن الحدّ،
 * وإلا null (يمكن المتابعة بفكّ الترميز).
 */
export function enforceBodyLimit(
  request: Request,
  maxBytes: number
): NextResponse | null {
  const len = declaredBodyLength(request);
  if (len !== null && len > maxBytes) {
    return NextResponse.json(
      { ok: false, error: "حجم الطلب أكبر من المسموح" },
      { status: 413 }
    );
  }
  return null;
}