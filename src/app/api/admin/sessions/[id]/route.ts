import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";
import { computeBilling } from "@/lib/billing";
import { readHourlyRate } from "@/lib/settings";
import { orderTotal, orderUnits, type OrderDetails } from "@/lib/orders";

export const dynamic = "force-dynamic";

// تفاصيل جلسة واحدة (طالب + كرسي + طلبات الخدمات + معاينة الفوترة)
// — تفتحها لوحة المدير عند الضغط على كرسي مشغول في خريطة القاعات،
// ونافذة "إنهاء الجلسة" تبني معاينتها من هذا الرد.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return jsonError("admin-session-detail", new Error("bad id"), 400, "معرّف جلسة غير صالح");
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        status: true,
        billableHours: true,
        sessionAmount: true,
        hourlyRateSnapshot: true,
        discountScope: true,
        discountType: true,
        discountValue: true,
        discountAmount: true,
        discountNote: true,
        finalAmount: true,
        student: { select: { id: true, name: true, phone: true } },
        spot: {
          select: { id: true, room: true, groupLabel: true, seatNumber: true },
        },
        orders: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            details: true,
            service: { select: { name: true, category: true, price: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      return jsonError("admin-session-detail", new Error("not found"), 404, "الجلسة غير موجودة");
    }

    // معاينة الفوترة الحالية: للجلسات النشطة تُحسب الآن (تقديراً)،
    // وللمنتهية تُقرأ من لقطة الفوترة المحفوظة.
    const hourlyRate = await readHourlyRate(prisma);
    const now = new Date();
    const previewEnd = session.checkOut ?? now;
    let billableHours: number;
    let hoursAmount: number;
    let rateUsed: number;
    if (session.status === "ended" && session.billableHours != null && session.sessionAmount != null) {
      billableHours = session.billableHours;
      hoursAmount = session.sessionAmount.toNumber();
      rateUsed = session.hourlyRateSnapshot ? session.hourlyRateSnapshot.toNumber() : hourlyRate;
    } else {
      const billing = computeBilling(session.checkIn, previewEnd, hourlyRate);
      billableHours = billing.billableHours;
      hoursAmount = billing.amount;
      rateUsed = hourlyRate;
    }

    const ordersAmount = session.orders.reduce(
      (sum, o) =>
        o.status === "done"
          ? sum +
            orderTotal(
              Number(o.service.price),
              o.details as OrderDetails | null
            )
          : sum,
      0
    );
    const grossTotal = Math.round((hoursAmount + ordersAmount) * 100) / 100;

    return NextResponse.json({
      ok: true,
      session: {
        id: session.id,
        status: session.status,
        check_in: session.checkIn.toISOString(),
        check_out: session.checkOut ? session.checkOut.toISOString() : null,
        student_name: session.student.name,
        student_phone: session.student.phone,
        spot_id: session.spot.id,
        spot_room: session.spot.room,
        spot_group_label: session.spot.groupLabel,
        spot_seat_number: session.spot.seatNumber,
        orders: session.orders.map((o) => {
          const details = (o.details as OrderDetails | null) ?? null;
          const unitPrice = Number(o.service.price);
          return {
            id: o.id,
            status: o.status,
            service_name: o.service.name,
            service_category: o.service.category,
            service_price: o.service.price.toString(),
            units: orderUnits(details),
            total: orderTotal(unitPrice, details),
            created_at: o.createdAt.toISOString(),
          };
        }),
        preview: {
          hourly_rate: rateUsed,
          billable_hours: billableHours,
          hours_amount: hoursAmount,
          orders_amount: ordersAmount,
          gross_total: grossTotal,
          final_amount: session.finalAmount
            ? session.finalAmount.toNumber()
            : session.status === "ended"
              ? grossTotal
              : null,
        },
        discount:
          session.discountScope && session.discountType && session.discountAmount
            ? {
                scope: session.discountScope,
                type: session.discountType,
                value: session.discountValue ? session.discountValue.toNumber() : null,
                amount: session.discountAmount.toNumber(),
                note: session.discountNote,
              }
            : null,
      },
      server_now: Date.now(),
    });
  } catch (err) {
    return jsonError("admin-session-detail", err, 500, "تعذّر تحميل تفاصيل الجلسة");
  }
}
