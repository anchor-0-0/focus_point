import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { SEAT_GROUPS, type SeatGroup } from "@/lib/rooms";
import { enforceBodyLimit, MAX_JSON_BODY_BYTES } from "@/lib/body-limit";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { setStudentSessionCookie } from "@/lib/student-session";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AssignResult = {
  session_id: string;
  spot_id: string;
  group_label: string;
  seat_number: number;
  room: string;
  seat_group: string;
} | null;

export async function POST(request: Request) {
  // حد مبكر لحجم الجسم + حواجز معدل (عام وخاص بالطالب).
  const tooLarge = enforceBodyLimit(request, MAX_JSON_BODY_BYTES);
  if (tooLarge) return tooLarge;

  const limiter = checkRateLimit("assign-chair:global", 40, 60_000);
  if (!limiter.allowed) {
    return rateLimitResponse(
      limiter.retryAfterMs,
      "طلبات كثيرة في وقت قصير، انتظر قليلاً ثم أعد المحاولة"
    );
  }

  let body: { student_id?: string; seat_group?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "بيانات الطلب غير صحيحة" },
      { status: 400 }
    );
  }

  const studentId = body.student_id?.trim() ?? "";
  const seatGroup = body.seat_group?.trim() ?? "";

  if (!studentId || !seatGroup) {
    return NextResponse.json(
      { ok: false, error: "student_id و seat_group مطلوبان" },
      { status: 400 }
    );
  }

  if (!UUID_RE.test(studentId)) {
    return NextResponse.json(
      { ok: false, error: "معرّف الطالب غير صالح" },
      { status: 400 }
    );
  }

  const studentLimiter = checkRateLimit(`assign-chair:student:${studentId}`, 10, 60_000);
  if (!studentLimiter.allowed) {
    return rateLimitResponse(
      studentLimiter.retryAfterMs,
      "طلبات كثيرة من نفس الطالب، انتظر قليلاً ثم أعد المحاولة"
    );
  }

  if (!SEAT_GROUPS.includes(seatGroup as SeatGroup)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "seat_group غير صالح (المتاح: social_table, silent_writing, silent_bar, smoking_bar)",
      },
      { status: 400 }
    );
  }

  try {
    // منع التكرار: إن كان للطالب جلسة نشطة حالياً (سواء بنفس السجل أو
    // سجل سابق يحمل نفس الاسم) نوجّهه لجلسته، لا ننشئ جلسة جديدة.
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        sessions: {
          where: { status: "active" },
          select: { id: true },
          orderBy: { checkIn: "desc" },
          take: 1,
        },
      },
    });

    if (student) {
      if (student.sessions.length > 0) {
        await setStudentSessionCookie(student.sessions[0].id);
        return NextResponse.json({
          ok: true,
          session_id: student.sessions[0].id,
          redirect: true,
        });
      }

      // طالب قديم بنفس الاسم لديه جلسة نشطة (سجلات مكررة سابقة):
      // نوجّه لجلسته بدل تخصيص كرسي جديد.
      const activeByName = await prisma.session.findFirst({
        where: {
          status: "active",
          student: { name: student.name, id: { not: student.id } },
        },
        select: { id: true },
        orderBy: { checkIn: "desc" },
      });
      if (activeByName) {
        await setStudentSessionCookie(activeByName.id);
        return NextResponse.json({
          ok: true,
          session_id: activeByName.id,
          redirect: true,
        });
      }
    }

    // public.assign_random_chair(p_seat_group text, p_student_id uuid)
    // تُنشأ في migration (seat_groups وتُحدَّث في chair_based_spots)
    // وتُستدعى عبر $queryRaw.
    const rows = await prisma.$queryRaw<{ fn: string | null }[]>`
      select public.assign_random_chair(${seatGroup}::text, ${studentId}::uuid) as fn
    `;

    const raw = rows[0]?.fn ?? null;
    // الحقل يعود كنص json؛ نُطبيع إن كان نصاً.
    const data: AssignResult = raw
      ? (typeof raw === "string" ? JSON.parse(raw) : raw)
      : null;

    // الدالة أعادت NULL عندما لا توجد كراسي متاحة في هذه المجموعة.
    if (!data) {
      return NextResponse.json(
        {
          ok: false,
          error: "عذراً، لا توجد كراسي متاحة في هذا القسم حالياً",
          no_spot: true,
        },
        { status: 200 }
      );
    }

    await setStudentSessionCookie(data.session_id);

    return NextResponse.json({
      ok: true,
      session_id: data.session_id,
      spot_id: data.spot_id,
      room: data.room,
      seat_group: data.seat_group,
      group_label: data.group_label,
      seat_number: data.seat_number,
    });
  } catch (err) {
    // سباق متزامن نادر: حاول طلبان لنفس الطالب تخصيص مقعد معاً —
    // الفهرس الفريد (sessions_active_student_idx) رفض الجلسة الثانية.
    // بدل خطأ 500، نوجّه لجلسته النشطة.
    if (String(err).includes("23505")) {
      const active = await prisma.session.findFirst({
        where: { studentId, status: "active" },
        select: { id: true },
        orderBy: { checkIn: "desc" },
      });
      if (active) {
        await setStudentSessionCookie(active.id);
        return NextResponse.json({
          ok: true,
          session_id: active.id,
          redirect: true,
        });
      }
    }
    return jsonError(
      "assign-chair",
      err,
      500,
      "تعذّر تخصيص الكرسي، الرجاء المحاولة مرة أخرى"
    );
  }
}