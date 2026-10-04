import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";

export const dynamic = "force-dynamic";

// قراءة كل الخدمات، وإنشاء خدمة جديدة (إضافة).
export async function GET() {
  const denied = await requireAdminJson();
  if (denied) return denied;

  try {
    const services = await prisma.service.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({
      ok: true,
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        price: s.price.toNumber(),
      })),
    });
  } catch (err) {
    return jsonError("admin-services", err, 500, "تعذّر تحميل الخدمات");
  }
}

export async function POST(request: Request) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  let body: { name?: string; category?: string; price?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "بيانات الطلب غير صحيحة" },
      { status: 400 }
    );
  }

  const name = body.name?.trim() ?? "";
  const category = body.category?.trim() ?? null;
  const price = Number(body.price);

  if (!name) {
    return NextResponse.json(
      { ok: false, error: "اسم الخدمة مطلوب" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json(
      { ok: false, error: "سعر صالح مطلوب (رقم غير سالب)" },
      { status: 400 }
    );
  }

  try {
    const service = await prisma.service.create({
      data: {
        name,
        category: category || null,
        price,
      },
    });

    return NextResponse.json({
      ok: true,
      service: {
        id: service.id,
        name: service.name,
        category: service.category,
        price: service.price.toNumber(),
      },
    });
  } catch (err) {
    return jsonError("admin-services-create", err, 500, "تعذّر إضافة الخدمة");
  }
}