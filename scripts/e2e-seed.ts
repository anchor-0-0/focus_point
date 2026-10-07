// e2e-seed: بذر بيانات اختبار بقيم حتمية — كل الطوابع مبنية نسبياً على
// «يوم دمشق الحالي» (بدل تواريخ ثابتة تتقادم مع مرور الوقت).
// الخادم يقرأ الطابع المخزَّن بإزاحة -3س (يعدّه حائط دمشق)، فنطرح 3 ساعات
// من منتصف ليل دمشق لبناء الطابع الذي يقابله في القاعدة.
//   - A وB دخلا أمس وانتهيا بعد منتصف ليل دمشق (بداية اليوم):
//     يظهران في تقرير الأمس (دخلاً) وفي لوحة/سجل اليوم (خروجاً).
//   - D وE داخل اليوم، مثبَّتان قبل «الآن» دائماً.
//   - C نشطة الآن (تدخين) — تُعرض مبالغها المتوقعة في جدول الجلسات الحي.
// المبالغ: A=4س+شاي1500+عصير3000×2 → 4×10000+1500+6000 = 47500،
// B=5س → 50000، D/E=ساعة → 10000. (عصير بكمية 2 يتحقق من ضرب السعر)
// يُطبع JSON: {RATE, A..E, dayNow, dayA, services_total, tea_price, juice_price}
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/prisma/client";

config({ path: ".env.local" });

const RATE = 10000;

const damascusDateParts = (utc: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Damascus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(utc);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

async function main() {
  const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
  const prisma = new PrismaClient({ adapter: pool });

  const services = await prisma.service.findMany({ orderBy: { name: "asc" } });
  const tea = services.find((s) => s.name.includes("شاي"));
  const juice = services.find((s) => s.name.includes("عصير"));
  const fallback = services.slice(0, 2);
  const teaSvc = tea ?? fallback[0];
  const juiceSvc = juice ?? fallback[1] ?? fallback[0];
  if (!teaSvc || !juiceSvc) throw new Error("no services available");

  const dayNow = damascusDateParts(new Date());
  const dayA = damascusDateParts(new Date(Date.now() - 24 * 3600 * 1000));
  const now = new Date();

  // الطوابع تُبنى نسبياً ليوم دمشق الحالي بدل تواريخ ثابتة تتقادم:
  // الخادم يقرأ الطابع المخزَّن بإزاحة -3س (حائط دمشق)، فنطرح 3 ساعات
  // من منتصف ليل دمشق لنحصل على الطابع الفعلي الذي يقابله في القاعدة.
  const damascusMidnightUtc = (day: string) =>
    new Date(`${day}T00:00:00.000Z`).getTime() - 3 * 3600 * 1000;
  const startOfToday = damascusMidnightUtc(dayNow);
  const startOfYesterday = damascusMidnightUtc(dayA);

  async function freeSpot(room: string) {
    const spot = await prisma.spot.findFirst({
      where: { room, isOccupied: false },
    });
    if (!spot) throw new Error(`no free spot in room ${room}`);
    return spot;
  }

  async function sessionWithSpot(input: {
    name: string;
    phone: string;
    group: string;
    status: "active" | "ended";
    checkIn: Date;
    checkOut?: Date;
    billable?: number;
  }) {
    const spot = await freeSpot(input.group);
    return prisma.session.create({
      data: {
        student: { create: { name: input.name, phone: input.phone } },
        spot: { connect: { id: spot.id } },
        status: input.status,
        checkIn: input.checkIn,
        checkOut: input.status === "ended" ? input.checkOut ?? null : null,
        billableHours: input.status === "ended" ? input.billable : null,
        sessionAmount:
          input.status === "ended" && input.billable ? input.billable * RATE : null,
        hourlyRateSnapshot: input.status === "ended" ? RATE : null,
      },
    });
  }

  // دخول مساء الأمس وإنهاء بعد منتصف ليل دمشق (بداية اليوم): للتقرير
  // التاريخي (دخلاً) وللأمس/اليوم (خروجاً) معاً.
  const A = await sessionWithSpot({
    name: "اختبار أحمد",
    phone: "0921111111",
    group: "social",
    status: "ended",
    checkIn: new Date(startOfYesterday + 20.5 * 3600 * 1000),
    checkOut: new Date(startOfToday + 0.25 * 3600 * 1000),
    billable: 4,
  });
  await prisma.order.create({
    data: {
      sessionId: A.id,
      serviceId: teaSvc.id,
      status: "done",
      details: { quantity: 1, sugar: "سكر متوسط" },
      createdAt: new Date(startOfYesterday + 21.25 * 3600 * 1000),
    },
  });
  await prisma.order.create({
    data: {
      sessionId: A.id,
      serviceId: juiceSvc.id,
      status: "done",
      details: { quantity: 2 },
      createdAt: new Date(startOfYesterday + 21.5 * 3600 * 1000),
    },
  });

  const B = await sessionWithSpot({
    name: "اختبار سارة",
    phone: "0921111112",
    group: "silent",
    status: "ended",
    checkIn: new Date(startOfYesterday + 18.75 * 3600 * 1000),
    checkOut: new Date(startOfToday + 0 * 3600 * 1000),
    billable: 5,
  });

  const C = await sessionWithSpot({
    name: "اختبار عمر",
    phone: "0921111113",
    group: "smoking",
    status: "active",
    // تبدأ قبل «الآن» بقليل (بعد منتصف الليل) حتى تبقى مدتها موجبة وقيمها
    // المتوقعة تُحسب من وقت فعلي في الماضي.
    checkIn: new Date(now.getTime() - 15 * 60 * 1000),
  });

  // نثبّت D وE قبل «الآن» دائماً: نسندهما للخلف إن تجاوز الوقت يوميّا.
  const dOut = Math.min(startOfToday + 1.33 * 3600 * 1000, now.getTime() - 45 * 60 * 1000);
  const D = await sessionWithSpot({
    name: "اختبار دي",
    phone: "0921111114",
    group: "social",
    status: "ended",
    checkIn: new Date(dOut - 60 * 60 * 1000),
    checkOut: new Date(dOut),
    billable: 1,
  });

  // نثبّت E قبل «الآن» دائماً: نسندها للخلف إن تجاوز الوقت 3 ساعات اليوم.
  const eOut = Math.min(startOfToday + 3 * 3600 * 1000, now.getTime() - 30 * 60 * 1000);
  const E = await sessionWithSpot({
    name: "اختبار إي",
    phone: "0921111115",
    group: "silent",
    status: "ended",
    checkIn: new Date(eOut - 15 * 60 * 1000),
    checkOut: new Date(eOut),
    billable: 1,
  });

  const out = {
    RATE,
    A: A.id,
    B: B.id,
    C: C.id,
    D: D.id,
    E: E.id,
    dayNow,
    dayA,
    services_total: Number(teaSvc.price) + Number(juiceSvc.price) * 2,
    tea_price: Number(teaSvc.price),
    juice_price: Number(juiceSvc.price),
    A_services_total: Number(teaSvc.price) + Number(juiceSvc.price) * 2,
    A_session_amount: 4 * RATE,
    A_total: 4 * RATE + Number(teaSvc.price) + Number(juiceSvc.price) * 2,
    spotA_room: "social",
    spotB_room: "silent",
  };
  console.log(JSON.stringify(out, null, 1));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("SEED FAILED:", e?.message ?? e);
  process.exit(1);
});