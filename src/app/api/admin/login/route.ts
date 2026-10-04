import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  createSessionToken,
  getActiveSessionToken,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// حد معدّل على محاولات الدخول: 5 محاولات في الدقيقة — يوقف تخمين
// كلمة المرور المتسلسل على الشبكة قبل أن تصل أي محاولة للتحقق.
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  const limiter = checkRateLimit("admin-login", LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!limiter.allowed) {
    return rateLimitResponse(
      limiter.retryAfterMs,
      "محاولات كثيرة للدخول، انتظر دقيقة وأعد المحاولة"
    );
  }

  let body: { password?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const password = body.password ?? "";

  if (!verifyPassword(password)) {
    return NextResponse.json(
      { ok: false, error: "كلمة المرور غير صحيحة" },
      { status: 401 }
    );
  }

  const cookieStore = await cookies();
  const present = cookieStore.get(ADMIN_COOKIE)?.value;

  // جلسة واحدة فقط: إن كانت جلسة سارية على جهاز آخر، نرفض فتح ثانية.
  const active = getActiveSessionToken();
  if (active && present !== active) {
    return NextResponse.json(
      {
        ok: false,
        error: "توجد جلسة مدير مفعّلة بالفعل، أنهِها أولاً ثم أعد الدخول",
      },
      { status: 409 }
    );
  }

  // دوّرنا العلامة بلا قيد ولا تزوير: أي جلسة قديمة تسقط تلقائياً.
  const { token } = createSessionToken();
  cookieStore.set(ADMIN_COOKIE, token, sessionCookieOptions());

  return NextResponse.json({ ok: true });
}