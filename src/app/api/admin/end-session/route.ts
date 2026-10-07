import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";
import { computeBilling } from "@/lib/billing";
import { readHourlyRate } from "@/lib/settings";

export const dynamic = "force-dynamic";

// إنهاء جلسة نشطة:
//   - sessions.status = 'ended'  و check_out = now()
//   - حساب الأجر المالي للجلسة: billable_hours (حد أدنى ساعة) +
//     session_amount (ساعات × سعر الساعة) + hourly_rate_snapshot (السعر
//     وقت الإنهاء) — تُحفظ كلها داخل نفس الـ transaction.
//   - spots.is_occupied = false
//   - orders غير الملبّاة (pending) → cancelled (تختفي من إشعارات الداشبورد)
// كل ذلك داخل transaction واحدة عبر Prisma.
//
// Idempotent: إذا كانت الجلسة منتهية أصلاً (أو ضُغط الزر مرتين)،
// نُعيد النجاح دون أي خطأ أو عملية مكررة.
export async function POST(request: Request) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  let body: { session_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "بيانات الطلب غير صحيحة" },
      { status: 400 }
    );
  }

  const sessionId = body.session_id?.trim() ?? "";
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "session_id مطلوب" },
      { status: 400 }
    );
  }

  try {
    // نقرأ الجلسة — إن لم تكن موجودة يُعاد 404.
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, spotId: true, checkIn: true },
    });

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "الجلسة غير موجودة" },
        { status: 404 }
      );
    }

    // Idempotency: إن كانت الجلسة منتهية بالفعل، نُعيد نجاحاً صامتاً (لا تغيير).
    if (session.status === "ended") {
      return NextResponse.json({ ok: true, already_ended: true });
    }

    // تحديث ذرّي ضمن transaction واحدة: حساب الأجر + إنهاء الجلسة +
    // تحرير المكان + إلغاء كل طلبات الخدمة المعلقة (pending) للجلسة
    // قبل أن تُلبّى، فتختفي تلقائياً من قائمة الإشعارات في الداشبورد.
    const checkOut = new Date();
    const billing = await prisma.$transaction(async (tx) => {
      const hourlyRate = await readHourlyRate(tx);

      const billing = computeBilling(session.checkIn, checkOut, hourlyRate);

      await tx.session.update({
        where: { id: sessionId },
        data: {
          status: "ended",
          checkOut,
          billableHours: billing.billableHours,
          sessionAmount: billing.amount,
          hourlyRateSnapshot: hourlyRate,
        },
      });

      await tx.spot.update({
        where: { id: session.spotId },
        data: { isOccupied: false },
      });

      await tx.order.updateMany({
        where: { sessionId, status: "pending" },
        data: { status: "cancelled" },
      });

      return billing;
    });

    return NextResponse.json({
      ok: true,
      already_ended: false,
      billable_hours: billing.billableHours,
      session_amount: billing.amount,
      hourly_rate: billing.amount / billing.billableHours,
    });
  } catch (err) {
    return jsonError("admin-end-session", err, 500, "تعذّر إنهاء الجلسة");
  }
}