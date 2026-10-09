import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";
import { computeBilling } from "@/lib/billing";
import { readHourlyRate } from "@/lib/settings";
import {
  computeDiscount,
  discountErrorText,
  type DiscountComputation,
  type DiscountScope,
  type DiscountType,
} from "@/lib/discount";
import { orderTotal, type OrderDetails } from "@/lib/orders";

export const dynamic = "force-dynamic";

// إنهاء جلسة نشطة:
//   - sessions.status = 'ended'  و check_out = now()
//   - حساب الأجر المالي للجلسة: billable_hours (حد أدنى ساعة) +
//     session_amount (رسوم الساعات قبل الخصم) + hourly_rate_snapshot.
//   - خصم اختياري (إن وُجد) يُعاد حسابه بالكامل هنا من الأرقام المرجعية
//     (لا نثق بأي رقم قادم من الواجهة) ويُحفظ: discount_scope/type/value/
//     amount/note + final_amount (المبلغ النهائي بعد الخصم).
//   - spots.is_occupied = false
//   - orders غير الملبّاة (pending) → cancelled (تختفي من إشعارات الداشبورد)
// كل ذلك داخل transaction واحدة عبر Prisma.
//
// Idempotent: إذا كانت الجلسة منتهية أصلاً (أو ضُغط الزر مرتين)،
// نُعيد النجاح دون أي خطأ أو عملية مكررة.

type DiscountBody = {
  scope?: unknown;
  type?: unknown;
  value?: unknown;
  note?: unknown;
};

export async function POST(request: Request) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  let body: { session_id?: string; discount?: DiscountBody | null };
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

    const checkOut = new Date();
    const hourlyRate = await readHourlyRate(prisma);
    const billing = computeBilling(session.checkIn, checkOut, hourlyRate);

    // مجموع الطلبات المنفّذة (done) — أساس نطاق "orders" وأيضاً نصف
    // فاتورة الخدمات. الملغاة والمعلقة لا تدخل أبداً.
    const doneOrders = await prisma.order.findMany({
      where: { sessionId, status: "done" },
      select: { details: true, service: { select: { price: true } } },
    });
    const ordersAmount = doneOrders.reduce(
      (sum, o) =>
        sum +
        orderTotal(
          Number(o.service.price),
          o.details as OrderDetails | null
        ),
      0
    );

    // التحقق الصارم من الخصم — أي قيمة غير صالحة تُرفض بخطأ واضح (400)
    // قبل أي تغيير بالقاعدة.
    let discount: DiscountComputation | null = null;

    const rawDiscount = body.discount;
    if (rawDiscount !== undefined && rawDiscount !== null) {
      const validation = computeDiscount(
        {
          scope: rawDiscount.scope as DiscountScope,
          type: rawDiscount.type as DiscountType,
          value: Number(rawDiscount.value),
          note: typeof rawDiscount.note === "string" ? rawDiscount.note : null,
        },
        {
          billableHours: billing.billableHours,
          hourlyRate,
          hoursAmount: billing.amount,
          ordersAmount,
        }
      );
      if (!validation.ok) {
        return NextResponse.json(
          { ok: false, code: validation.code, error: discountErrorText(validation.code) },
          { status: 400 }
        );
      }
      // قيمة صفر = بلا خصم (لا نحفظ صفّاً فارغاً بلا داعٍ).
      discount = validation.discount.amount > 0 ? validation.discount : null;
    }

    const grossTotal = Math.round((billing.amount + ordersAmount) * 100) / 100;
    const finalAmount = discount ? discount.finalAmount : grossTotal;

    // تحديث ذرّي ضمن transaction واحدة: الفوترة + الخصم + إنهاء الجلسة +
    // تحرير المكان + إلغاء كل طلبات الخدمة المعلقة (pending) للجلسة
    // قبل أن تُلبّى، فتختفي تلقائياً من قائمة الإشعارات في الداشبورد.
    await prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id: sessionId },
        data: {
          status: "ended",
          checkOut,
          billableHours: billing.billableHours,
          sessionAmount: billing.amount,
          hourlyRateSnapshot: hourlyRate,
          discountScope: discount?.scope ?? null,
          discountType: discount?.type ?? null,
          discountValue: discount ? discount.value : null,
          discountAmount: discount ? discount.amount : null,
          discountNote: discount?.note ?? null,
          finalAmount,
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
    });

    return NextResponse.json({
      ok: true,
      already_ended: false,
      billable_hours: billing.billableHours,
      session_amount: billing.amount,
      hourly_rate: hourlyRate,
      orders_amount: ordersAmount,
      gross_total: grossTotal,
      discount: discount
        ? {
            scope: discount.scope,
            type: discount.type,
            value: discount.value,
            amount: discount.amount,
            note: discount.note,
          }
        : null,
      final_amount: finalAmount,
    });
  } catch (err) {
    return jsonError("admin-end-session", err, 500, "تعذّر إنهاء الجلسة");
  }
}
