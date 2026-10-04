import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import {
  SUGAR_LEVELS,
  type OrderDetails,
  type SugarLevel,
} from "@/lib/orders";
import { enforceBodyLimit, MAX_JSON_BODY_BYTES } from "@/lib/body-limit";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getStudentSessionCookie } from "@/lib/student-session";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOTE_MAX = 200;

function isUuid(value: string) {
  return UUID_RE.test(value);
}

export async function POST(request: Request) {
  // حد مبكر لحجم الجسم قبل request.json().
  const tooLarge = enforceBodyLimit(request, MAX_JSON_BODY_BYTES);
  if (tooLarge) return tooLarge;

  let body: { session_id?: string; service_id?: string; details?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "بيانات الطلب غير صحيحة" },
      { status: 400 }
    );
  }

  const sessionId = body.session_id?.trim() ?? "";
  const serviceId = body.service_id?.trim() ?? "";
  const details = body.details;

  if (!isUuid(sessionId) || !isUuid(serviceId)) {
    return NextResponse.json(
      { ok: false, error: "session_id و service_id مطلوبان بصيغة صحيحة" },
      { status: 400 }
    );
  }

  // ربط الجلسة بجهاز الطالب (A5): لا يُقبل إرسال طلبات باسم جلسة لم
  // يُثبت الطالب هويته لها عبر الكوكي (checkin/assign-chair).
  const boundSessionId = await getStudentSessionCookie();
  if (boundSessionId !== sessionId) {
    return NextResponse.json(
      {
        ok: false,
        error: "جلسة غير موثوقة، الرجاء تسجيل الدخول من جديد",
        untrusted_session: true,
      },
      { status: 403 }
    );
  }

  // حواجز معدل: مقياس خاص بالجلسة (60/ساعة) + عام (120/دقيقة).
  const perSessionLimiter = checkRateLimit(`orders:${sessionId}`, 60, 60 * 60_000);
  if (!perSessionLimiter.allowed) {
    return rateLimitResponse(
      perSessionLimiter.retryAfterMs,
      "وصلت حد الطلبات لهذه الجلسة، انتظر قليلاً ثم أعد المحاولة"
    );
  }
  const globalLimiter = checkRateLimit("orders:global", 120, 60_000);
  if (!globalLimiter.allowed) {
    return rateLimitResponse(
      globalLimiter.retryAfterMs,
      "الطلبات الواردة كثيرة حالياً، انتظر قليلاً ثم أعد المحاولة"
    );
  }

  if (!details || typeof details !== "object") {
    return NextResponse.json(
      { ok: false, error: "details مطلوب" },
      { status: 400 }
    );
  }

  try {
    // ============================================================
    // الحماية/التحقق من الصلاحيات يتم يدوياً هنا (لا RLS في القاعدة):
    // نتحقق من وجود الجلسة ونشاطها قبل قبول أي طلب خدمات.
    // ============================================================
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "الجلسة غير موجودة" },
        { status: 404 }
      );
    }

    if (session.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "انتهت الجلسة، لا يمكن إرسال طلبات جديدة" },
        { status: 409 }
      );
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json(
        { ok: false, error: "الخدمة غير موجودة" },
        { status: 404 }
      );
    }

    // بنية details: quantity اختياري + note اختياري + sugar (لشاي/قهوة فقط).
    const d = details as Partial<OrderDetails>;
    const clean: OrderDetails = {};

    if (d.quantity !== undefined) {
      const quantity = Number(d.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 500) {
        return NextResponse.json(
          { ok: false, error: "الكمية يجب أن تكون رقماً صحيحاً موجباً" },
          { status: 400 }
        );
      }
      clean.quantity = quantity;
    }

    if (d.note !== undefined) {
      if (typeof d.note !== "string") {
        return NextResponse.json(
          { ok: false, error: "الملاحظة يجب أن تكون نصاً" },
          { status: 400 }
        );
      }
      const note = d.note.trim();
      if (note.length > NOTE_MAX) {
        return NextResponse.json(
          { ok: false, error: "الملاحظة طويلة جداً (حتى 200 حرف)" },
          { status: 400 }
        );
      }
      if (note !== "") clean.note = note;
    }

    // مستوى السكر مسموح للمشروبات التي تدعمه (شاي/قهوة) فقط —
    // عصير لا يقبل سكراً أبداً (المواصفة: الكمية فقط).
    const isTeaOrCoffee =
      service.name.includes("شاي") || service.name.includes("قهوة");
    const serviceIsDrink =
      service.category === "مشروبات" || isTeaOrCoffee;

    if (d.sugar !== undefined) {
      if (!serviceIsDrink) {
        return NextResponse.json(
          { ok: false, error: "مستوى السكر مسموح للمشروبات فقط" },
          { status: 400 }
        );
      }
      if (!isTeaOrCoffee) {
        return NextResponse.json(
          { ok: false, error: "هذا المشروب لا يقبل تحديد مستوى السكر" },
          { status: 400 }
        );
      }
      if (!SUGAR_LEVELS.includes(d.sugar as SugarLevel)) {
        return NextResponse.json(
          { ok: false, error: "مستوى السكر غير صالح" },
          { status: 400 }
        );
      }
      clean.sugar = d.sugar as SugarLevel;
    }

    const order = await prisma.order.create({
      data: {
        sessionId,
        serviceId,
        status: "pending",
        details: clean as object,
      },
    });

    return NextResponse.json({
      ok: true,
      order_id: order.id,
    });
  } catch (err) {
    return jsonError("orders", err, 500, "تعذّر إرسال الطلب، الرجاء المحاولة مرة أخرى");
  }
}