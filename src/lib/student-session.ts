// ============================================================
// ربط جهاز الطالب بجلسته عبر كوكي httpOnly (A5)
// ------------------------------------------------------------
// يمنع أي جهاز يعرف معرّف الجلسة فقط (UUID من مسار الصفحة أو من
// استجابة status) من إرسال طلبات نيابةً عن الجلسة. الكوكي يُضبط في
// نقطة إثبات الهوية الوحيدة: تسجيل الدخول (/api/checkin عند وجود
// جلسة نشطة) أو تخصيص الكرسي (/api/assign-chair). كل عملية تحويل حالة
// (طلب خدمة/رفع طباعة) تتحقق من تطابق body.session_id مع الكوكي.
// ============================================================

import { cookies } from "next/headers";

export const STUDENT_COOKIE = "fp_student_session";

// صلاحية يوم كامل — تكفي أطول جلسة دراسة.
const MAX_AGE_SECONDS = 60 * 60 * 24;

export function studentCookieOptions() {
  const secure = process.env.COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

/** ربط الكوكي بجلسة الطالب (يُستدعى فقط من مسارات إثبات الهوية). */
export async function setStudentSessionCookie(sessionId: string) {
  const store = await cookies();
  store.set(STUDENT_COOKIE, sessionId, studentCookieOptions());
}

/** قراءة جلسة الطالب المربوطة بجهازه الحالي. */
export async function getStudentSessionCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(STUDENT_COOKIE)?.value;
}