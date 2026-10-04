import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { enforceBodyLimit, MAX_JSON_BODY_BYTES } from "@/lib/body-limit";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { setStudentSessionCookie } from "@/lib/student-session";

export const dynamic = "force-dynamic";

const NAME_MAX = 20;
const PHONE_RE = /^\d{7,15}$/;

export async function POST(request: Request) {
  // حد مبكر لحجم الجسم قبل request.json().
  const tooLarge = enforceBodyLimit(request, MAX_JSON_BODY_BYTES);
  if (tooLarge) return tooLarge;

  // حد معدل عام على التسجيل (دفع/إساءة بلا حصر).
  const limiter = checkRateLimit("checkin:global", 30, 60_000);
  if (!limiter.allowed) {
    return rateLimitResponse(
      limiter.retryAfterMs,
      "طلبات كثيرة في وقت قصير، انتظر قليلاً ثم أعد المحاولة"
    );
  }

  let body: { name?: string; phone?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "بيانات الطلب غير صحيحة" },
      { status: 400 }
    );
  }

  const name = body.name?.trim() ?? "";
  const phone = body.phone?.trim() ?? "";

  if (!name) {
    return NextResponse.json({ ok: false, error: "الاسم مطلوب" }, { status: 400 });
  }
  if (name.length > NAME_MAX) {
    return NextResponse.json(
      { ok: false, error: "الاسم طويل جداً (حتى 20 حرفاً)" },
      { status: 400 }
    );
  }
  if (!phone) {
    return NextResponse.json({ ok: false, error: "رقم الهاتف مطلوب" }, { status: 400 });
  }
  if (!PHONE_RE.test(phone)) {
    return NextResponse.json(
      { ok: false, error: "رقم الهاتف يجب أن يحتوي أرقاماً فقط" },
      { status: 400 }
    );
  }

  try {
    // منع التكرار: إن كانت للطالب (نفس الاسم + الهاتف) جلسة نشطة حالياً
    // نوجّهه لجلسته مباشرةً — وأثناء ذلك نربط كوكي جلسته بجهازه (A5) حتى
    // لا يتمكّن أي جهاز آخر يعرف المعرف من إرسال طلبات باسمه.
    const active = await prisma.session.findFirst({
      where: {
        status: "active",
        student: { name, phone },
      },
      select: { id: true },
      orderBy: { checkIn: "desc" },
    });

    if (active) {
      await setStudentSessionCookie(active.id);
      return NextResponse.json({
        ok: true,
        session_id: active.id,
        redirect: true,
      });
    }

    // لا جلسة نشطة: نعيد استخدام سجل الطالب الموجود بدل تكرار بياناته.
    const existing = await prisma.student.findFirst({
      where: { name, phone },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return NextResponse.json({
        ok: true,
        student_id: existing.id,
      });
    }

    const student = await prisma.student.create({
      data: { name, phone },
    });

    return NextResponse.json({
      ok: true,
      student_id: student.id,
    });
  } catch (err) {
    return jsonError("checkin", err, 500, "تعذّر تسجيل الدخول، الرجاء المحاولة مرة أخرى");
  }
}