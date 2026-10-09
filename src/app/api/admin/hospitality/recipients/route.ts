import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";

export const dynamic = "force-dynamic";

const TYPES = ["guest", "management"] as const;

// ============================================================
// أسماء الضيافة المحفوظة (ضيوف/إدارة) — تُعاد استخدامها في
// التسجيل السريع. الإيقاف يفضَّل على الحذف عندما للاسم سجلات
// (الحذف الفعلي يُشطّل رابط السجلات القديمة SET NULL).
// ============================================================

/**
 * GET /api/admin/hospitality/recipients?type=guest|management
 * كل الأسماء (الفعّالة أولاً) مع عدد السجلات لكل اسم.
 */
export async function GET(req: Request) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const typeParam = url.searchParams.get("type")?.trim() ?? "";
    if (typeParam && !TYPES.includes(typeParam as (typeof TYPES)[number])) {
      return NextResponse.json(
        { ok: false, error: "نوع غير صالح" },
        { status: 400 }
      );
    }

    const recipients = await prisma.hospitalityRecipient.findMany({
      where: typeParam
        ? { type: typeParam as (typeof TYPES)[number] }
        : undefined,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { _count: { select: { logs: true } } },
    });

    return NextResponse.json({
      ok: true,
      recipients: recipients.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        is_active: r.isActive,
        logs_count: r._count.logs,
        created_at: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return jsonError("admin-hospitality-recipients", err, 500, "تعذّر تحميل الأسماء");
  }
}

/**
 * POST — إضافة اسم جديد (أو إرجاع الموجود المطابق إن كان فعّالاً).
 * body: { name, type }
 */
export async function POST(request: Request) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  let body: { name?: unknown; type?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "بيانات الطلب غير صحيحة" },
      { status: 400 }
    );
  }

  const name = String(body.name ?? "").trim().slice(0, 60);
  const type = body.type;
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "الاسم مطلوب" },
      { status: 400 }
    );
  }
  if (type !== "guest" && type !== "management") {
    return NextResponse.json(
      { ok: false, error: "النوع غير صالح" },
      { status: 400 }
    );
  }

  try {
    // نفس الاسم بنفس النوع → نعيد الموجود (لا تكرار).
    const existing = await prisma.hospitalityRecipient.findFirst({
      where: { name, type },
    });
    if (existing) {
      if (!existing.isActive) {
        await prisma.hospitalityRecipient.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      }
      return NextResponse.json({
        ok: true,
        recipient: {
          id: existing.id,
          name: existing.name,
          type: existing.type,
          is_active: true,
        },
        existing: true,
      });
    }

    const created = await prisma.hospitalityRecipient.create({
      data: { name, type },
    });
    return NextResponse.json({
      ok: true,
      recipient: {
        id: created.id,
        name: created.name,
        type: created.type,
        is_active: created.isActive,
      },
      existing: false,
    });
  } catch (err) {
    return jsonError("admin-hospitality-recipients-create", err, 500, "تعذّر حفظ الاسم");
  }
}

/**
 * PATCH — تعديل الاسم أو إيقافه/تفعيله.
 * body: { id, name?, is_active? }
 */
export async function PATCH(request: Request) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  let body: { id?: unknown; name?: unknown; is_active?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "بيانات الطلب غير صحيحة" },
      { status: 400 }
    );
  }

  const id = String(body.id ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json(
      { ok: false, error: "معرّف غير صالح" },
      { status: 400 }
    );
  }

  const data: { name?: string; isActive?: boolean } = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 60);
    if (!name) {
      return NextResponse.json(
        { ok: false, error: "الاسم مطلوب" },
        { status: 400 }
      );
    }
    data.name = name;
  }
  if (body.is_active !== undefined) data.isActive = Boolean(body.is_active);

  try {
    const updated = await prisma.hospitalityRecipient.update({
      where: { id },
      data,
    });
    return NextResponse.json({
      ok: true,
      recipient: {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        is_active: updated.isActive,
      },
    });
  } catch (err) {
    return jsonError("admin-hospitality-recipients-patch", err, 500, "تعذّر تحديث الاسم");
  }
}

/**
 * DELETE — body { id }: بلا سجلات → حذف فعلي؛ وإلا إيقاف (soft)
 * حتى تبقى السجلات القديمة مرتبطة باسمها.
 */
export async function DELETE(request: Request) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "بيانات الطلب غير صحيحة" },
      { status: 400 }
    );
  }

  const id = String(body.id ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json(
      { ok: false, error: "معرّف غير صالح" },
      { status: 400 }
    );
  }

  try {
    const logsCount = await prisma.hospitalityLog.count({
      where: { recipientId: id },
    });

    if (logsCount > 0) {
      const updated = await prisma.hospitalityRecipient.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        ok: true,
        deactivated: true,
        recipient: {
          id: updated.id,
          name: updated.name,
          type: updated.type,
          is_active: updated.isActive,
        },
      });
    }

    await prisma.hospitalityRecipient.delete({ where: { id } });
    return NextResponse.json({ ok: true, deactivated: false, deleted: true });
  } catch (err) {
    return jsonError("admin-hospitality-recipients-delete", err, 500, "تعذّر حذف الاسم");
  }
}
