import { prisma } from "../src/lib/prisma";

type ChairSeed = {
  room: string;
  groupLabel: string;
  seatNumber: number;
  seatGroup: string;
};

// يبني كراسي مجموعة: seats عدد الكراسي داخل group_label.
function groupChairs(
  room: string,
  label: string,
  seats: number,
  seatGroup: string
): ChairSeed[] {
  return Array.from({ length: seats }, (_, i) => ({
    room,
    groupLabel: label,
    seatNumber: i + 1,
    seatGroup,
  }));
}

// التوزيعة النهائية: 35 كرسي بالضبط على 4 مجموعات تخصيص.
const chairs: ChairSeed[] = [
  // Social: 5 طاولات دائرية × 3 كراسي = 15 → social_table
  ...groupChairs("social", "Social - Table 1", 3, "social_table"),
  ...groupChairs("social", "Social - Table 2", 3, "social_table"),
  ...groupChairs("social", "Social - Table 3", 3, "social_table"),
  ...groupChairs("social", "Social - Table 4", 3, "social_table"),
  ...groupChairs("social", "Social - Table 5", 3, "social_table"),

  // Silent: طاولتا كتابة × 4 كراسي = 8 → silent_writing + بار دراسة بـ 6 → silent_bar
  ...groupChairs("silent", "Silent - Writing Table A", 4, "silent_writing"),
  ...groupChairs("silent", "Silent - Writing Table B", 4, "silent_writing"),
  ...groupChairs("silent", "Silent - Study Bar", 6, "silent_bar"),

  // Smoking: بار واحد × 6 كراسي → smoking_bar
  ...groupChairs("smoking", "Smoking - Bar", 6, "smoking_bar"),
];

// الخدمات: قسم الطباعة (بطاقة واحدة، لكن قيد مزدوج للمحاسبة)
// + المشروبات الثلاثة فقط (شاي، قهوة، عصير).
const services = [
  { name: "طباعة أبيض وأسود", category: "طباعة", price: 500 },
  { name: "طباعة ملونة", category: "طباعة", price: 1500 },
  { name: "شاي", category: "مشروبات", price: 1500 },
  { name: "قهوة", category: "مشروبات", price: 2500 },
  { name: "عصير", category: "مشروبات", price: 3000 },
];

async function main() {
  // ============================================================
  // الكراسي: مسح تسلسلي آمن (orders ← sessions ← spots) لأن
  // الطلبات والجلسات القديمة ترتبط بالكراسي عبر FK بقيود Restrict.
  // هذا الـ seed هو إعادة ضبط لبيئة التطوير، لذا مسح هذه البيانات
  // مقبول ومتوافق مع ما تفعله الميجريشنز في بيئة التطوير.
  // ============================================================
  await prisma.order.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.spot.deleteMany({});
  await prisma.spot.createMany({ data: chairs });

  // ============================================================
  // الخدمات: نُعيد البناء من الصفر (الطلبات اتُمسحت أعلاه، فلا
  // يوجد أي FK يمنع) بحيث يكون الكتالوج مطابقاً للمواصفة تماماً:
  // طباعة (أبيض/ملوّن للاحتفاظ بالسعرين للمحاسبة) + شاي/قهوة/عصير فقط.
  // ============================================================
  await prisma.service.deleteMany({});
  await prisma.service.createMany({ data: services });

  // ============================================================
  // الإعدادات: سعر الساعة الافتراضي 10,000 ل.س (قابل للتعديل من /admin/settings).
  // ============================================================
  await prisma.setting.upsert({
    where: { key: "hourly_rate_syp" },
    update: {},
    create: { key: "hourly_rate_syp", value: "10000" },
  });

  // ============================================================
  // التقارير
  // ============================================================
  const chairsByGroup = await prisma.spot.groupBy({
    by: ["seatGroup"],
    _count: { _all: true },
  });
  const totalChairs = chairsByGroup.reduce((sum, r) => sum + r._count._all, 0);

  const byRoom = await prisma.spot.groupBy({
    by: ["room"],
    _count: { _all: true },
  });

  const allServices = await prisma.service.findMany({
    orderBy: [{ category: "asc" }, { price: "asc" }],
  });

  console.log("Seeded chairs:", totalChairs);
  for (const row of chairsByGroup) {
    console.log(`  - ${row.seatGroup}: ${row._count._all}`);
  }
  for (const row of byRoom) {
    console.log(`  room=${row.room}: ${row._count._all}`);
  }
  console.log("Services:");
  for (const s of allServices) {
    console.log(`  - ${s.name} [${s.category ?? "—"}] ${s.price} ل.س`);
  }

  if (totalChairs !== 35) {
    throw new Error(`توزيعة الكراسي خاطئة: المتوقع 35 والموجود ${totalChairs}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });