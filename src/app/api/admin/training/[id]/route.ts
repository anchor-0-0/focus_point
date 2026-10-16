import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";
import { isUuid } from "@/lib/uuid";

const DAY_SET = new Set(["sat", "sun", "mon", "tue", "wed", "thu", "fri"]);
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function cleanString(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim();
}

function isNonNegativeInt(v: unknown): boolean {
  if (typeof v !== "number") return false;
  if (!Number.isFinite(v)) return false;
  if (!Number.isInteger(v)) return false;
  return v >= 0;
}

function isDecimalNonNegative(v: unknown): boolean {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return false;
  return n >= 0;
}

const isUuidCheck = (v: string) => isUuid(v);

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { id } = await params;
  if (!isUuidCheck(id)) {
    return NextResponse.json({ ok: false, error: "id غير صالح" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "بيانات الطلب غير صحيحة" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;

  const name = cleanString(b.name);
  const code = cleanString(b.code);
  const trainer = cleanString(b.trainer);
  const startDateStr = cleanString(b.startDate);
  const endDateStr = cleanString(b.endDate);
  const startTime = cleanString(b.startTime);
  const endTime = cleanString(b.endTime);
  const daysRaw = Array.isArray(b.days) ? (b.days as unknown[]) : [];
  const notes = cleanString(b.notes);

  if (!name) return NextResponse.json({ ok: false, error: "اسم الدورة مطلوب" }, { status: 400 });
  if (!code) return NextResponse.json({ ok: false, error: "رمز الدورة مطلوب" }, { status: 400 });
  if (!trainer) return NextResponse.json({ ok: false, error: "اسم المدرب مطلوب" }, { status: 400 });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
    return NextResponse.json({ ok: false, error: "تاريخ البدء غير صالح (YYYY-MM-DD)" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
    return NextResponse.json({ ok: false, error: "تاريخ النهاية غير صالح (YYYY-MM-DD)" }, { status: 400 });
  }
  const s = new Date(startDateStr + "T00:00:00");
  const e = new Date(endDateStr + "T00:00:00");
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return NextResponse.json({ ok: false, error: "صيغة التواريخ غير صحيحة" }, { status: 400 });
  }
  if (e < s) {
    return NextResponse.json({ ok: false, error: "تاريخ النهاية لا يمكن أن يكون قبل تاريخ البدء" }, { status: 400 });
  }

  if (!TIME_RE.test(startTime)) {
    return NextResponse.json({ ok: false, error: "وقت البدء غير صالح (HH:MM)" }, { status: 400 });
  }
  if (!TIME_RE.test(endTime)) {
    return NextResponse.json({ ok: false, error: "وقت النهاية غير صالح (HH:MM)" }, { status: 400 });
  }
  const sh = parseInt(startTime.slice(0, 2), 10);
  const sm = parseInt(startTime.slice(3, 5), 10);
  const eh = parseInt(endTime.slice(0, 2), 10);
  const em = parseInt(endTime.slice(3, 5), 10);
  if (eh < sh || (eh === sh && em <= sm)) {
    return NextResponse.json({ ok: false, error: "وقت النهاية يجب أن يكون بعد وقت البدء" }, { status: 400 });
  }

  const days = daysRaw
    .filter((d): d is string => typeof d === "string" && DAY_SET.has(d))
    .slice(0, 7);
  if (days.length === 0) {
    return NextResponse.json({ ok: false, error: "يجب تحديد يوم واحد على الأقل من أيام الجلسات" }, { status: 400 });
  }

  const studentsCount = Number(b.studentsCount);
  const sessionsCount = Number(b.sessionsCount);
  const totalCost = Number(b.totalCost);
  const costPerStudent = Number(b.costPerStudent);
  const centerSharePercent = Number(b.centerSharePercent);

  if (!isNonNegativeInt(studentsCount)) return NextResponse.json({ ok: false, error: "عدد الطلاب غير صالح (عدد صحيح غير سالب)" }, { status: 400 });
  if (!isNonNegativeInt(sessionsCount)) return NextResponse.json({ ok: false, error: "عدد جلسات الدورة غير صالح (عدد صحيح غير سالب)" }, { status: 400 });
  if (!isDecimalNonNegative(totalCost)) return NextResponse.json({ ok: false, error: "التكلفة الكاملة غير صالحة (رقم غير سالب)" }, { status: 400 });
  if (!isDecimalNonNegative(costPerStudent)) return NextResponse.json({ ok: false, error: "تكلفة الشخص غير صالحة (رقم غير سالب)" }, { status: 400 });
  if (!isDecimalNonNegative(centerSharePercent)) return NextResponse.json({ ok: false, error: "نسبة المركز غير صالحة (رقم غير سالب)" }, { status: 400 });
  if (centerSharePercent > 100) {
    return NextResponse.json({ ok: false, error: "نسبة المركز يجب أن تكون بين 0 و100" }, { status: 400 });
  }

  try {
    const exists = await prisma.trainingCourse.findUnique({ where: { id }, select: { id: true, code: true } });
    if (!exists) {
      return NextResponse.json({ ok: false, error: "الدورة غير موجودة" }, { status: 404 });
    }

    // عدم تكرار الرمز إلا إذا بقي نفسه
    if (exists.code !== code) {
      const dup = await prisma.trainingCourse.findFirst({ where: { code }, select: { id: true } });
      if (dup) {
        return NextResponse.json({ ok: false, error: "رمز الدورة مسجل مسبقاً" }, { status: 409 });
      }
    }

    const updated = await prisma.trainingCourse.update({
      where: { id },
      data: {
        name,
        code,
        trainer,
        startDate: s,
        endDate: e,
        startTime,
        endTime,
        days,
        studentsCount,
        sessionsCount,
        totalCost,
        costPerStudent,
        centerSharePercent,
        notes: notes || null,
      },
    });

    return NextResponse.json({
      ok: true,
      course: {
        id: updated.id,
        name: updated.name,
        code: updated.code,
        trainer: updated.trainer,
        startDate: updated.startDate.toISOString().slice(0, 10),
        endDate: updated.endDate.toISOString().slice(0, 10),
        startTime: updated.startTime,
        endTime: updated.endTime,
        days: updated.days,
        studentsCount: updated.studentsCount,
        sessionsCount: updated.sessionsCount,
        totalCost: Number(updated.totalCost),
        costPerStudent: Number(updated.costPerStudent),
        centerSharePercent: Number(updated.centerSharePercent),
        notes: updated.notes ?? "",
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    return jsonError("admin-training-update", err, 500, "تعذّر تعديل دورة قاعة التدريب");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { id } = await params;
  if (!isUuidCheck(id)) {
    return NextResponse.json({ ok: false, error: "id غير صالح" }, { status: 400 });
  }

  try {
    const exists = await prisma.trainingCourse.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return NextResponse.json({ ok: false, error: "الدورة غير موجودة" }, { status: 404 });
    }

    await prisma.trainingCourse.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError("admin-training-delete", err, 500, "تعذّر حذف دورة قاعة التدريب");
  }
}
