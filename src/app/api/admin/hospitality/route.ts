import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import { requireAdminJson } from "@/lib/admin-require";
import { damascusDayBoundaries } from "@/lib/report";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = ["guest", "management"] as const;
type RecipientType = (typeof TYPES)[number];

// ============================================================
// سجل الضيافة — قراءة (مع إحصاء لكل نوع ثم المجموع) وتسجيل جديد.
// ------------------------------------------------------------
// الضيافة إحصاء تقديري فقط — لا تدخل بالإيرادات إطلاقاً
// (لا في الداشبورد ولا في التقارير المالية).
// ============================================================

type HospitalitySummaryBucket = {
  logs: number;
  /** عدد الأشخاص (مجموع guests_count) — زيارات/أشخاص. */
  people: number;
  /** مجموع الكميات المقدّمة. */
  quantity: number;
  /** عدد الأصناف المختلفة. */
  services_count: number;
  /** القيمة التقديرية = سعر لقطة وقت التسجيل × الكمية. */
  estimated_value: number;
  by_service: {
    service_id: string;
    service_name: string;
    quantity: number;
    estimated_value: number;
  }[];
};

function emptyBucket(): HospitalitySummaryBucket {
  return {
    logs: 0,
    people: 0,
    quantity: 0,
    services_count: 0,
    estimated_value: 0,
    by_service: [],
  };
}

/**
 * GET /api/admin/hospitality?from=YYYY-MM-DD&to=YYYY-MM-DD&type=&recipient_id=
 * سجل التسجيلات (الأحدث أولاً) + إحصاء لكل نوع ثم المجموع.
 * غياب التواريخ → كل الفترات.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from")?.trim() ?? "";
    const toParam = url.searchParams.get("to")?.trim() ?? "";
    const typeParam = url.searchParams.get("type")?.trim() ?? "";
    const recipientId = url.searchParams.get("recipient_id")?.trim() ?? "";

    const where: {
      createdAt?: { gte: Date; lt: Date };
      recipientType?: RecipientType;
      recipientId?: string;
    } = {};

    if (fromParam || toParam) {
      const from = fromParam || toParam;
      const to = toParam || fromParam;
      if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
        return NextResponse.json(
          { ok: false, error: "التاريخ بصيغة خاطئة — المطلوب YYYY-MM-DD" },
          { status: 400 }
        );
      }
      const { fromDate, toDate } = damascusDayBoundaries(
        from < to ? from : to,
        from < to ? to : from
      );
      where.createdAt = { gte: fromDate, lt: toDate };
    }

    if (typeParam) {
      if (!TYPES.includes(typeParam as RecipientType)) {
        return NextResponse.json(
          { ok: false, error: "نوع غير صالح" },
          { status: 400 }
        );
      }
      where.recipientType = typeParam as RecipientType;
    }
    if (recipientId) where.recipientId = recipientId;

    const [logs, services] = await Promise.all([
      prisma.hospitalityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 500,
        include: {
          service: { select: { id: true, name: true, category: true } },
          recipient: { select: { id: true, name: true } },
        },
      }),
      prisma.service.findMany({
        select: { id: true, name: true, category: true, price: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
    ]);

    // الإحصاء يشمل نفس مرشّحات القائمة (منطقي: ما تراه هو ما يُجمع).
    const statsLogs = await prisma.hospitalityLog.findMany({
      where,
      select: {
        recipientType: true,
        quantity: true,
        guestsCount: true,
        unitPriceSnapshot: true,
        serviceId: true,
        service: { select: { name: true } },
      },
    });

    const buckets: Record<RecipientType, HospitalitySummaryBucket> = {
      guest: emptyBucket(),
      management: emptyBucket(),
    };
    const serviceNames = new Map<string, string>();

    for (const l of statsLogs) {
      const type = (l.recipientType === "management"
        ? "management"
        : "guest") as RecipientType;
      const b = buckets[type];
      const value = Math.round(l.unitPriceSnapshot.toNumber() * l.quantity * 100) / 100;
      b.logs += 1;
      b.people += l.guestsCount;
      b.quantity += l.quantity;
      b.estimated_value =
        Math.round((b.estimated_value + value) * 100) / 100;
      serviceNames.set(l.serviceId, l.service.name);

      const key = l.serviceId;
      const existing = b.by_service.find((s) => s.service_id === key);
      if (existing) {
        existing.quantity += l.quantity;
        existing.estimated_value =
          Math.round((existing.estimated_value + value) * 100) / 100;
      } else {
        b.by_service.push({
          service_id: key,
          service_name: l.service.name,
          quantity: l.quantity,
          estimated_value: value,
        });
      }
    }

    const mergeBuckets = (
      a: HospitalitySummaryBucket,
      b: HospitalitySummaryBucket
    ): HospitalitySummaryBucket => ({
      logs: a.logs + b.logs,
      people: a.people + b.people,
      quantity: a.quantity + b.quantity,
      services_count: 0,
      estimated_value:
        Math.round((a.estimated_value + b.estimated_value) * 100) / 100,
      by_service: [],
    });

    // عدد الأصناف المختلفة = union بين حساب النوعين.
    const total = mergeBuckets(buckets.guest, buckets.management);
    total.services_count = new Set([
      ...buckets.guest.by_service.map((s) => s.service_id),
      ...buckets.management.by_service.map((s) => s.service_id),
    ]).size;
    buckets.guest.services_count = new Set(
      buckets.guest.by_service.map((s) => s.service_id)
    ).size;
    buckets.management.services_count = new Set(
      buckets.management.by_service.map((s) => s.service_id)
    ).size;

    // تفصيل الأصناف للمجموع (دمج بنفس الصنف عبر النوعين).
    const totalByService = new Map<
      string,
      { service_id: string; service_name: string; quantity: number; estimated_value: number }
    >();
    for (const b of [buckets.guest, buckets.management]) {
      for (const s of b.by_service) {
        const cur = totalByService.get(s.service_id);
        if (cur) {
          cur.quantity += s.quantity;
          cur.estimated_value =
            Math.round((cur.estimated_value + s.estimated_value) * 100) / 100;
        } else {
          totalByService.set(s.service_id, { ...s });
        }
      }
    }
    total.by_service = [...totalByService.values()];

    for (const b of [buckets.guest, buckets.management, total]) {
      b.by_service.sort((x, y) => y.quantity - x.quantity);
    }

    return NextResponse.json({
      ok: true,
      logs: logs.map((l) => ({
        id: l.id,
        created_at: l.createdAt.toISOString(),
        recipient_type: l.recipientType,
        recipient_label:
          l.recipient?.name ?? l.guestLabel ?? "—",
        recipient_id: l.recipientId,
        guest_label: l.guestLabel,
        guests_count: l.guestsCount,
        quantity: l.quantity,
        unit_price: l.unitPriceSnapshot.toNumber(),
        estimated_value:
          Math.round(l.unitPriceSnapshot.toNumber() * l.quantity * 100) / 100,
        service_id: l.serviceId,
        service_name: l.service.name,
        service_category: l.service.category,
        note: l.note,
      })),
      summary: {
        guest: buckets.guest,
        management: buckets.management,
        total,
      },
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        price: s.price.toNumber(),
      })),
      service_names: Object.fromEntries(serviceNames),
    });
  } catch (err) {
    return jsonError("admin-hospitality", err, 500, "تعذّر تحميل سجل الضيافة");
  }
}

/**
 * POST /api/admin/hospitality — تسجيل ضيافة واحدة.
 * body: { service_id, recipient_type: 'guest'|'management',
 *         recipient_id?, guest_label?, quantity, guests_count, note? }
 */
export async function POST(request: Request) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  let body: {
    service_id?: unknown;
    recipient_type?: unknown;
    recipient_id?: unknown;
    guest_label?: unknown;
    quantity?: unknown;
    guests_count?: unknown;
    note?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "بيانات الطلب غير صحيحة" },
      { status: 400 }
    );
  }

  const type = body.recipient_type;
  if (type !== "guest" && type !== "management") {
    return NextResponse.json(
      { ok: false, error: "نوع المستلم غير صالح (ضيف أو إدارة)" },
      { status: 400 }
    );
  }

  const serviceId = String(body.service_id ?? "").trim();
  const recipientId = String(body.recipient_id ?? "").trim() || null;
  const guestLabel = String(body.guest_label ?? "").trim().slice(0, 60) || null;
  const quantity = Number(body.quantity ?? 1);
  const guestsCount = Number(body.guests_count ?? 1);
  const note = String(body.note ?? "").trim().slice(0, 200) || null;

  if (!/^[0-9a-f-]{36}$/i.test(serviceId)) {
    return NextResponse.json(
      { ok: false, error: "صنف غير صالح" },
      { status: 400 }
    );
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    return NextResponse.json(
      { ok: false, error: "الكمية يجب أن تكون عدداً صحيحاً من 1 إلى 999" },
      { status: 400 }
    );
  }
  if (!Number.isInteger(guestsCount) || guestsCount < 1 || guestsCount > 999) {
    return NextResponse.json(
      { ok: false, error: "عدد الأشخاص يجب أن يكون عدداً صحيحاً من 1 إلى 999" },
      { status: 400 }
    );
  }

  if (type === "management" && !recipientId) {
    return NextResponse.json(
      { ok: false, error: "اختر اسم إدارة محفوظاً أو أضف اسماً جديداً" },
      { status: 400 }
    );
  }
  if (type === "guest" && !guestLabel) {
    return NextResponse.json(
      { ok: false, error: "اكتب اسم الضيف" },
      { status: 400 }
    );
  }

  try {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, price: true, category: true },
    });
    if (!service) {
      return NextResponse.json(
        { ok: false, error: "الصنف غير موجود" },
        { status: 404 }
      );
    }

    let recipientName: string | null = null;
    if (recipientId) {
      const recipient = await prisma.hospitalityRecipient.findUnique({
        where: { id: recipientId },
      });
      if (!recipient || recipient.type !== type || !recipient.isActive) {
        return NextResponse.json(
          { ok: false, error: "الاسم المحفوظ غير متاح" },
          { status: 400 }
        );
      }
      recipientName = recipient.name;
    }

    const log = await prisma.hospitalityLog.create({
      data: {
        serviceId: service.id,
        recipientType: type,
        recipientId,
        guestLabel: type === "guest" ? guestLabel : null,
        quantity,
        guestsCount,
        note,
        unitPriceSnapshot: service.price,
      },
    });

    return NextResponse.json({
      ok: true,
      log: {
        id: log.id,
        created_at: log.createdAt.toISOString(),
        recipient_type: type,
        recipient_label: recipientName ?? guestLabel ?? "—",
        guests_count: guestsCount,
        quantity,
        unit_price: service.price.toNumber(),
        estimated_value:
          Math.round(service.price.toNumber() * quantity * 100) / 100,
        service_id: service.id,
        note,
      },
    });
  } catch (err) {
    return jsonError("admin-hospitality-create", err, 500, "تعذّر تسجيل الضيافة");
  }
}
