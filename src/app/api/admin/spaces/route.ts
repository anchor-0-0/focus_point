import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";

export const dynamic = "force-dynamic";

// كل الكراسي بحالتها الحية مع اسم الطالب ولحظة دخوله (للخريطة، polling).
export async function GET() {
  const denied = await requireAdminJson();
  if (denied) return denied;

  try {
    const spots = await prisma.spot.findMany({
      orderBy: [{ room: "asc" }, { groupLabel: "asc" }, { seatNumber: "asc" }],
      select: {
        id: true,
        room: true,
        groupLabel: true,
        seatNumber: true,
        isOccupied: true,
      },
    });

    // الجلسات النشطة لربط الكرسي بالطالب الجالس عليه.
    const activeSessions = await prisma.session.findMany({
      where: { status: "active" },
      select: {
        id: true,
        spotId: true,
        checkIn: true,
        student: { select: { name: true } },
      },
    });
    const bySpot = new Map(
      activeSessions.map((s) => [s.spotId, s])
    );

    return NextResponse.json({
      ok: true,
      spots: spots.map((s) => {
        const session = bySpot.get(s.id);
        return {
          id: s.id,
          room: s.room,
          group_label: s.groupLabel,
          seat_number: s.seatNumber,
          occupied: s.isOccupied,
          session_id: session ? session.id : null,
          student_name: session ? session.student.name : null,
          check_in: session ? session.checkIn.toISOString() : null,
        };
      }),
    });
  } catch (err) {
    return jsonError("admin-spaces", err, 500, "تعذّر تحميل الأماكن");
  }
}