import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// نقطة فحص الاتصال بقاعدة البيانات محلياً — تعمل query على جدول spots.
// ملاحظة أمان: لا توجد RLS على مستوى القاعدة (PostgreSQL محلي فقط)،
// وأي تحقق من الصلاحيات يتم يدوياً داخل route handlers.
export async function GET() {
  try {
    const spotsCount = await prisma.spot.count();

    return NextResponse.json({
      ok: true,
      message: "Connection to PostgreSQL is working",
      spots_count: spotsCount,
    });
  } catch (err) {
    return jsonError("health", err, 500, "تعذّر الاتصال بقاعدة البيانات");
  }
}