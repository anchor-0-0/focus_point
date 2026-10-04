import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);

// PUT: تعديل خدمة. DELETE: حذف خدمة.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json(
      { ok: false, error: "id غير صالح" },
      { status: 400 }
    );
  }

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
    const exists = await prisma.service.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json(
        { ok: false, error: "الخدمة غير موجودة" },
        { status: 404 }
      );
    }

    const service = await prisma.service.update({
      where: { id },
      data: { name, category: category || null, price },
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
    return jsonError("admin-services-update", err, 500, "تعذّر تعديل الخدمة");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json(
      { ok: false, error: "id غير صالح" },
      { status: 400 }
    );
  }

  try {
    // في حال وجود طلبات مرتبطة بالخدمة، نرفض الحذف (قيد قاعدة البيانات)
    // ونُعلم المستخدم بوضوح.
    const orderCount = await prisma.order.count({
      where: { serviceId: id },
    });
    if (orderCount > 0) {
      return NextResponse.json(
        { ok: false, error: "لا يمكن حذف خدمة لها طلبات مسجلة" },
        { status: 409 }
      );
    }

    await prisma.service.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError("admin-services-delete", err, 500, "تعذّر حذف الخدمة");
  }
}