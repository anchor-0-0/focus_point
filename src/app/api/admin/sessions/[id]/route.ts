import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";

export const dynamic = "force-dynamic";

// تفاصيل جلسة واحدة (طالب + كرسي + طلبات الخدمات) — تفتحها لوحة المدير
// عند الضغط على كرسي مشغول في خريطة القاعات.
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
        student: { select: { id: true, name: true, phone: true } },
        spot: {
          select: { id: true, room: true, groupLabel: true, seatNumber: true },
        },
        orders: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            service: { select: { name: true, category: true, price: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      return jsonError("admin-session-detail", new Error("not found"), 404, "الجلسة غير موجودة");
    }

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
        orders: session.orders.map((o) => ({
          id: o.id,
          status: o.status,
          service_name: o.service.name,
          service_category: o.service.category,
          service_price: o.service.price.toString(),
          created_at: o.createdAt.toISOString(),
        })),
      },
      server_now: Date.now(),
    });
  } catch (err) {
    return jsonError("admin-session-detail", err, 500, "تعذّر تحميل تفاصيل الجلسة");
  }
}
