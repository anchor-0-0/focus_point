import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";
import { damascusToday, damascusDayBoundaries } from "@/lib/report";
import { computeBilling } from "@/lib/billing";
import { readHourlyRate } from "@/lib/settings";
import { orderTotal, type OrderDetails } from "@/lib/orders";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/admin/sessions/history?from=YYYY-MM-DD&to=YYYY-MM-DD
 * سجل الجلسات المنتهية (status='ended') حسب يوم/فترة الخروج بمنطقة دمشق.
 * لكل جلسة: المدة الفعلية، الساعات المحتسبة، مبلغ الجلسة، مجموع الخدمات
 * والمنفذة (دون)، والمبلغ الكلي. تُرتب زمنياً من الأقدم إلى الأحدث.
 * الجلسات القديمة (قبل ميزة الفوترة) تُحسب لها القيم الآن دون تعديل القاعدة.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    let from = url.searchParams.get("from")?.trim() ?? "";
    let to = url.searchParams.get("to")?.trim() ?? "";

    // فترة افتراضية = اليوم بمنطقة دمشق عند غياب التواريخ.
    if (!from && !to) {
      from = to = damascusToday();
    } else if (from && !to) {
      to = from;
    } else if (!from && to) {
      from = to;
    }

    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return NextResponse.json(
        {
          ok: false,
          error: "التاريخ بصيغة خاطئة — المطلوب YYYY-MM-DD",
        },
        { status: 400 }
      );
    }
    if (from > to) [from, to] = [to, from];

    const { fromDate, toDate } = damascusDayBoundaries(from, to);
    const hourlyRate = await readHourlyRate(prisma);

    const sessions = await prisma.session.findMany({
      where: { status: "ended", checkOut: { gte: fromDate, lt: toDate } },
      include: {
        student: { select: { name: true, phone: true } },
        spot: { select: { room: true, groupLabel: true, seatNumber: true } },
        orders: {
          where: { status: "done" },
          select: { details: true, service: { select: { price: true } } },
        },
      },
      orderBy: { checkOut: "asc" },
    });

    const rows = sessions.map((s) => {
      const checkOut = s.checkOut ?? s.checkIn;
      const actualMs = Math.max(0, checkOut.getTime() - s.checkIn.getTime());

      let billableHours = s.billableHours;
      let sessionAmount = s.sessionAmount ? Number(s.sessionAmount) : null;
      if (billableHours == null || sessionAmount == null) {
        const billing = computeBilling(s.checkIn, checkOut, hourlyRate);
        billableHours = billing.billableHours;
        sessionAmount = billing.amount;
      }

      const servicesTotal = s.orders.reduce(
        (sum, o) =>
          sum +
          orderTotal(
            Number(o.service.price),
            o.details as OrderDetails | null
          ),
        0
      );

      return {
        session_id: s.id,
        student_name: s.student.name,
        room: s.spot.room,
        group_label: s.spot.groupLabel,
        seat_number: s.spot.seatNumber,
        check_in: s.checkIn.toISOString(),
        check_out: checkOut.toISOString(),
        actual_duration_ms: actualMs,
        billable_hours: billableHours,
        session_amount: sessionAmount,
        services_total: servicesTotal,
        total: sessionAmount + servicesTotal,
      };
    });

    return NextResponse.json({ ok: true, from, to, sessions: rows });
  } catch (err) {
    return jsonError(
      "admin-sessions-history",
      err,
      500,
      "تعذّر تحميل سجل الجلسات"
    );
  }
}