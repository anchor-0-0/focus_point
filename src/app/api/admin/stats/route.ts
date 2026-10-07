import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";

export const dynamic = "force-dynamic";

// ملخص لوحة التحكم: إيرادات اليوم (رسوم جلسات + خدمات) + إشغال الأماكن.
export async function GET() {
  const denied = await requireAdminJson();
  if (denied) return denied;

  try {
    // إيرادات اليوم (الجزء الأول — الخدمات): مجموع (سعر الوحدة × عدد
    // الوحدات) لطلبات status='done' أُنشئت "اليوم" بمنطقة المستخدم
    // (Asia/Damascus). الوحدات = quantity (المشروبات) أو copies (الطباعة)
    // — ومن لا يحمل details يُحسب له وحدة واحدة.
    // ملاحظة: الأزمنة مخزنة في القاعدة بـ UTC (انظر src/lib/prisma.ts) —
    // فنحسب بداية اليوم بمنطقة المستخدم ثم نقارن بالطابع المطلق.
    const servicesRevenueRows =
      await prisma.$queryRaw<{ total: string | null; count: bigint }[]>`
        select
          coalesce(sum(
            s.price *
            case
              when (o.details->>'quantity') ~ '^[0-9]+$'
                then (o.details->>'quantity')::int
              when (o.details->>'copies') ~ '^[0-9]+$'
                then (o.details->>'copies')::int
              else 1
            end
          ), 0) as total,
          count(*) as count
        from public.orders o
        join public.services s on s.id = o.service_id
        where o.status = 'done'
          and o.created_at >= (
            date_trunc('day', now() at time zone 'Asia/Damascus')
            at time zone 'Asia/Damascus'
          )
      `;
    const revenue_services = Number(servicesRevenueRows[0]?.total ?? 0);
    const doneCount = Number(servicesRevenueRows[0]?.count ?? 0);

    // إيرادات اليوم (الجزء الثاني — رسوم الجلسات): مجموع (session_amount)
    // للجلسات المنتهية اليوم. الجلسات القديمة (قبل ميزة الفوترة) بلا مبلغ
    // تُحسب صفراً ولا تتحمّل علامة فارقة.
    const sessionsRevenueRows =
      await prisma.$queryRaw<{ total: string | null; count: bigint }[]>`
        select
          coalesce(sum(s.session_amount), 0) as total,
          count(*) filter (where s.session_amount > 0) as count
        from public.sessions s
        where s.status = 'ended'
          and s.check_out >= (
            date_trunc('day', now() at time zone 'Asia/Damascus')
            at time zone 'Asia/Damascus'
          )
      `;
    const revenue_sessions = Number(sessionsRevenueRows[0]?.total ?? 0);
    const billedSessionsCount = Number(sessionsRevenueRows[0]?.count ?? 0);

    // ساعات اليوم المحتسبة + عدد الجلسات المنتهية + التوزيع حسب القاعة.
    // (billable_hours قد يكون null لجلسات منتهية قبل ميزة الفوترة — تُحسب صفراً).
    const hoursRows =
      await prisma.$queryRaw<
        {
          hours: string | null;
          ended_count: bigint;
          social_hours: string | null;
          silent_hours: string | null;
          smoking_hours: string | null;
        }[]
      >`
        select
          coalesce(sum(s.billable_hours), 0) as hours,
          count(*) as ended_count,
          coalesce(sum(s.billable_hours) filter (where sp.room = 'social'), 0) as social_hours,
          coalesce(sum(s.billable_hours) filter (where sp.room = 'silent'), 0) as silent_hours,
          coalesce(sum(s.billable_hours) filter (where sp.room = 'smoking'), 0) as smoking_hours
        from public.sessions s
        join public.spots sp on sp.id = s.spot_id
        where s.status = 'ended'
          and s.check_out >= (
            date_trunc('day', now() at time zone 'Asia/Damascus')
            at time zone 'Asia/Damascus'
          )
      `;
    const billedHoursToday = Number(hoursRows[0]?.hours ?? 0);
    const endedSessionsToday = Number(hoursRows[0]?.ended_count ?? 0);

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
      revenue: revenue_services + revenue_sessions,
      revenue_services,
      revenue_sessions,
      done_count: doneCount,
      billed_sessions: billedSessionsCount,
      billed_hours_today: billedHoursToday,
      ended_sessions_today: endedSessionsToday,
      avg_billable_hours:
        endedSessionsToday > 0 ? billedHoursToday / endedSessionsToday : 0,
      hours_by_room: {
        social: Number(hoursRows[0]?.social_hours ?? 0),
        silent: Number(hoursRows[0]?.silent_hours ?? 0),
        smoking: Number(hoursRows[0]?.smoking_hours ?? 0),
      },
      occupied_total: occupiedTotal,
      total_spots: totalSpots,
      occupancy,
    });
  } catch (err) {
    return jsonError("admin-stats", err, 500, "تعذّر تحميل الإحصائيات");
  }
}