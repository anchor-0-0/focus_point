import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";

export const dynamic = "force-dynamic";

// ملخص لوحة التحكم: إيرادات اليوم + إشغال الأماكن (مقسّمة للنوع).
export async function GET() {
  const denied = await requireAdminJson();
  if (denied) return denied;

  try {
    // إيرادات اليوم: مجموع (service.price) لطلبات status='done'
    // أُنشئت "اليوم" بمنطقة المستخدم (Asia/Damascus).
    // ملاحظة: الأزمنة مخزنة في القاعدة بـ UTC (انظر src/lib/prisma.ts) —
    // فنحسب بداية اليوم بمنطقة المستخدم ثم نقارن بالطابع المطلق.
    const revenueRows =
      await prisma.$queryRaw<{ total: string | null; count: bigint }[]>`
        select
          coalesce(sum(s.price), 0) as total,
          count(*) as count
        from public.orders o
        join public.services s on s.id = o.service_id
        where o.status = 'done'
          and o.created_at >= (
            date_trunc('day', now() at time zone 'Asia/Damascus')
            at time zone 'Asia/Damascus'
          )
      `;
    const revenue = Number(revenueRows[0]?.total ?? 0);
    const doneCount = Number(revenueRows[0]?.count ?? 0);

    // الإشغال: كل قاعة مع عدد الكراسي المشغولة والإجمالي.
    const occupancyRows =
      await prisma.$queryRaw<
        { room: string; occupied: bigint; total: bigint }[]
      >`
        select
          room,
          count(*) filter (where is_occupied) as occupied,
          count(*) as total
        from public.spots
        group by room
      `;

    const occupancy = occupancyRows.map((row) => ({
      room: row.room,
      occupied: Number(row.occupied),
      total: Number(row.total),
    }));

    const occupiedTotal = occupancy.reduce((sum, r) => sum + r.occupied, 0);
    const totalSpots = occupancy.reduce((sum, r) => sum + r.total, 0);

    return NextResponse.json({
      ok: true,
      revenue,
      done_count: doneCount,
      occupied_total: occupiedTotal,
      total_spots: totalSpots,
      occupancy,
    });
  } catch (err) {
    return jsonError("admin-stats", err, 500, "تعذّر تحميل الإحصائيات");
  }
}