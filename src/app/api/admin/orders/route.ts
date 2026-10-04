import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";
import type { OrderDetails } from "@/lib/orders";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);

// GET: كل الطلبات المعلقة (pending) مع تفاصيلها — لقسم "الطلبات الواردة".
export async function GET() {
  const denied = await requireAdminJson();
  if (denied) return denied;

  try {
    const orders = await prisma.order.findMany({
      where: { status: "pending" },
      include: {
        service: { select: { name: true, price: true } },
        session: {
          select: {
            student: { select: { name: true } },
            spot: {
              select: {
                room: true,
                groupLabel: true,
                seatNumber: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const seatOf = (
      s: { room: string; groupLabel: string; seatNumber: number } | null
    ): string => {
      if (!s) return "—";
      return `${s.groupLabel} • مقعد ${s.seatNumber}`;
    };

    return NextResponse.json({
      ok: true,
      orders: orders.map((o) => ({
        id: o.id,
        service_name: o.service.name,
        price: o.service.price.toNumber(),
        details: o.details as OrderDetails | null,
        student_name: o.session.student.name,
        spot_label: seatOf(o.session.spot),
        created_at: o.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return jsonError("admin-orders", err, 500, "تعذّر تحميل الطلبات");
  }
}

// POST { order_id }: تغيير حالة الطلب إلى 'done'.
// Idempotent: طلب منتهٍ أصلاً يُعاد نجاحاً صامتاً بلا خطأ/تكرار.
export async function POST(request: Request) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  let body: { order_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "بيانات الطلب غير صحيحة" },
      { status: 400 }
    );
  }

  const orderId = body.order_id?.trim() ?? "";
  if (!isUuid(orderId)) {
    return NextResponse.json(
      { ok: false, error: "order_id مطلوب بصيغة صحيحة" },
      { status: 400 }
    );
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });

    if (!order) {
      return NextResponse.json(
        { ok: false, error: "الطلب غير موجود" },
        { status: 404 }
      );
    }

    if (order.status === "done") {
      return NextResponse.json({ ok: true, already_done: true });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: "done" },
    });

    return NextResponse.json({ ok: true, already_done: false });
  } catch (err) {
    return jsonError("admin-orders-done", err, 500, "تعذّر إتمام الطلب");
  }
}