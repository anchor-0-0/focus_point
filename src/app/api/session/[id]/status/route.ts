import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// استعلام خفيف وسريع: يعيد فقط حالة الجلسة ووقت الخروج (إن وُجد).
// تُستخدم هذه الـ route للتساؤل الدوري (polling) من صفحة الجلسة.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // معرّف غير صالح (-poll عشوائي/محاولة تخمين) → نفس جواب "غير موجود"
  // بدل رمي خطأ Prisma وإرجاع 500.
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { ok: false, error: "NotFound", status: null, check_out: null },
      { status: 404 }
    );
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id },
      select: { status: true, checkOut: true },
    });

    // جلسة غير موجودة → 404 منطقي يعالجها العميل.
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "NotFound", status: null, check_out: null },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: session.status,
      check_out: session.checkOut?.toISOString() ?? null,
      // موقّت الخادم الطازج ليصحّح العميل فرق ساعاته (skew) ويبقى العدّاد حياً.
      server_now: Date.now(),
    });
  } catch (err) {
    return jsonError("session-status", err, 500, "تعذّر جلب حالة الجلسة");
  }
}