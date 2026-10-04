import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";

export const dynamic = "force-dynamic";

// الجلسات النشطة حالياً — تُستخدم في قسم "الجلسات النشطة" (polling).
export async function GET() {
  const denied = await requireAdminJson();
  if (denied) return denied;

  try {
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

    return NextResponse.json({
      ok: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        student_name: s.student.name,
        spot_room: s.spot.room,
        spot_group_label: s.spot.groupLabel,
        spot_seat_number: s.spot.seatNumber,
        check_in: s.checkIn.toISOString(),
      })),
    });
  } catch (err) {
    return jsonError("admin-sessions", err, 500, "تعذّر تحميل الجلسات");
  }
}