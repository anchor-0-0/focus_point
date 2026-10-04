import { randomBytes, timingSafeEqual } from "node:crypto";

// ============================================================
// جلسة المدير — جلسة واحدة مفعّلة في كل لحظة (A2 + A4)
// -----------------------------------------------------------------
// سابقاً كانت الكوكي مجرد sha256 حتمي لكلمة المرور: قيمة ثابتة لا
// تُدار ولا تُلغى، وأي جهاز يعرف كلمة المرور يكسب نفس الكوكي.
// الآن:
//  - عند الدخول تُنشأ علامة (token) عشوائية وتُخزَّن في ذاكرة
//    الخادم فقط؛ الكوكي يحمل العلامة نفسها (لا شيء يُشتق من
//    كلمة المرور) فيستحيل تزويرها بدون معرفة الخادم.
//  - جلسة واحدة فقط: أي دخول جديد يلغي كل جلسات سابقة (createSessionToken
//    يمسح الخريطة) — لا يُفتح عدد ثانٍ بينما الأولى مفعّلة، وعند الدخول
//    تُدوَّر العلامة تلقائياً فتسقط الجلسات القديمة (rotation = revoke).
//  - إنهاء الجلسة (logout) يحذف العلامة من الخادم — لم تعد الكوكي
//    صالحة في أي جهاز.
//  - انتهاء الصلاحية بعد 12 ساعة يفحص في بداية كل تحقق.
//
// ملاحظات تنفيذية:
//  - التخزين في globalThis ليعيش عبر HMR أثناء التطوير. عند إعادة
//    تشغيل الخادم تُلغى كل الجلسات (يعيد المدير الدخول) — مقبول على
//    نطاق LAN أحادي العملية.
//  - الخريطة في ذاكرة العملية الواحدة: لا يجري تشاركها بين عدة
//    عمليات/عُقد. لإعداد متعدد العمليات يجب نقل الجلسات لقاعدة بيانات.
// ============================================================

export const ADMIN_COOKIE = "fp_admin_session";

// مدة صلاحية جلسة المدير: 12 ساعة.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type AdminSession = {
  expiresAt: number;
};

const globalRef = globalThis as unknown as {
  __fpAdminSessions?: Map<string, AdminSession>;
};

function sessions(): Map<string, AdminSession> {
  if (!globalRef.__fpAdminSessions) globalRef.__fpAdminSessions = new Map();
  return globalRef.__fpAdminSessions;
}

function sweepExpired() {
  const map = sessions();
  const now = Date.now();
  for (const [token, session] of map) {
    if (now >= session.expiresAt) map.delete(token);
  }
}

function getPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}

/** تحقق آمن (زمن ثابت) من كلمة المرور. */
export function verifyPassword(input: string): boolean {
  const expected = Buffer.from(getPassword());
  const received = Buffer.from(input ?? "");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/**
 * ينشئ جلسة مدير جديدة حصرية: يمسح أي جلسة سابقة ثم يولد علامة
 * عشوائية. يعيد العلامة لتوضع في الكوكي — لا يوجد اشتقاق قابل
 * للتنبؤ من كلمة المرور.
 */
export function createSessionToken(): { token: string; expiresAt: number } {
  sweepExpired();
  const map = sessions();
  map.clear(); // جلسة واحدة في كل لحظة
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  map.set(token, { expiresAt });
  return { token, expiresAt };
}

/** هل الكوكي يحمل علامة جلسة فعّالة (موجودة + غير منتهية)؟ */
export function isValidSessionCookie(value: string | undefined): boolean {
  if (!value) return false;
  sweepExpired();
  const session = sessions().get(value);
  return !!session && Date.now() < session.expiresAt;
}

/** إنهاء الجلسة الحالية من الخادم (بطلان فوري لكل الكوكيز). */
export function destroySessionToken(value: string | undefined): void {
  if (!value) return;
  sessions().delete(value);
}

/** العلامة الفعّالة حالياً (إن وُجدت) — لفرض "جلسة واحدة". */
export function getActiveSessionToken(): string | undefined {
  sweepExpired();
  return sessions().keys().next().value as string | undefined;
}

export function sessionCookieOptions() {
  // الموقع عبر HTTP على الشبكة المحلية بلا TLS؛ Secure لا يُرسَل مع
  // HTTP إلا على localhost. يُفعَّل Sign فقط عند COOKIE_SECURE=true.
  const secure = process.env.COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}