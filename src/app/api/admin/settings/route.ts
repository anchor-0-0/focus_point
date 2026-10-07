import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";
import { HOURLY_RATE_KEY, readHourlyRate } from "@/lib/settings";

export const dynamic = "force-dynamic";

// قراءة الإعدادات الحالية (سعر الساعة) لحقول صفحة /admin/settings.
export async function GET() {
  const denied = await requireAdminJson();
  if (denied) return denied;

  try {
    const hourlyRate = await readHourlyRate(prisma);
    return NextResponse.json({ ok: true, settings: { hourly_rate_syp: hourlyRate } });
  } catch (err) {
    return jsonError("admin-settings-get", err, 500, "تعذّر تحميل الإعدادات");
  }
}

// حفظ سعر الساعة الجديد.
export async function PUT(request: Request) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  let body: { hourly_rate_syp?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "بيانات الطلب غير صحيحة" },
      { status: 400 }
    );
  }

  const hourlyRate = Math.floor(Number(body.hourly_rate_syp));
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    return NextResponse.json(
      { ok: false, error: "سعر ساعة صالح مطلوب (رقم موجب أكبر من صفر)" },
      { status: 400 }
    );
  }

  try {
    await prisma.setting.upsert({
      where: { key: HOURLY_RATE_KEY },
      update: { value: String(hourlyRate) },
      create: { key: HOURLY_RATE_KEY, value: String(hourlyRate) },
    });

    return NextResponse.json({ ok: true, settings: { hourly_rate_syp: hourlyRate } });
  } catch (err) {
    return jsonError("admin-settings-update", err, 500, "فشل حفظ الإعدادات");
  }
}