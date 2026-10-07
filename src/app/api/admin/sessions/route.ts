import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";
import { computeBilling } from "@/lib/billing";
import { readHourlyRate } from "@/lib/settings";

export const dynamic = "force-dynamic";

// الجلسات النشطة حالياً — تُستخدم في قسم "الجلسات النشطة" (polling).
// يُحسب لكل جلسة (حيّاً على الخادم) عدد الساعات المحتسبة والمبلغ المتوقع
// حسب الإيقاف الافتراضي المعمّم: حد أدنى ساعة + ساعة إضافية إذا تجاوزت
// الدقائق الباقية 30 دقيقة (نفس منطق computeBilling عند الإنهاء).
export async function GET() {
  const denied = await requireAdminJson();
  if (denied) return denied;

  try {
    const hourlyRate = await readHourlyRate(prisma);
    const sessions = await prisma.session.findMany({
      where: { status: "active" },
      include: {
        student: { select: { name: true } },
        spot: {
          select: { room: true, groupLabel: true, seatNumber: true },
        },
      },
      orderBy: { checkIn: "asc" },
    });
    const now = new Date();

    return NextResponse.json({
      ok: true,
      sessions: sessions.map((s) => {
        const billing = computeBilling(s.checkIn, now, hourlyRate);
        return {
          id: s.id,
          student_name: s.student.name,
          spot_room: s.spot.room,
          spot_group_label: s.spot.groupLabel,
          spot_seat_number: s.spot.seatNumber,
          check_in: s.checkIn.toISOString(),
          elapsed_ms: now.getTime() - s.checkIn.getTime(),
          billable_hours: billing.billableHours,
          session_amount: billing.amount,
        };
      }),
    });
  } catch (err) {
    return jsonError("admin-sessions", err, 500, "تعذّر تحميل الجلسات");
  }
}