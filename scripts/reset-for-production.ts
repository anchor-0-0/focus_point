// Reset-for-production: يمسح بيانات التشغيل (الطلاب/الجلسات/الطلبات)
// ويبقي الخدمات (الكشكول) والمقاعد الـ35 ثابتة. أعلام is_occupied تُصفر.
// التشغيل: npx tsx scripts/reset-for-production.ts [--yes]
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/prisma/client";

config({ path: ".env.local" });

const allowed = process.argv.includes("--yes") || process.argv.includes("--force");
if (!allowed) {
  console.error("Aborted: this deletes Orders/Sessions/Students. Re-run with --yes.");
  process.exit(2);
}

const say = (s: unknown = "") => console.log(s);

async function main() {
  const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
  const prisma = new PrismaClient({ adapter: pool });

  const before = {
    orders: await prisma.order.count(),
    sessions: await prisma.session.count(),
    students: await prisma.student.count(),
    spots: await prisma.spot.count(),
    services: await prisma.service.count(),
  };
  say(`before: ${JSON.stringify(before)}`);

  const delOrders = await prisma.order.deleteMany({});
  const delSessions = await prisma.session.deleteMany({});
  const delStudents = await prisma.student.deleteMany({});
  const resetSpots = await prisma.spot.updateMany({ data: { isOccupied: false } });

  const after = {
    orders: await prisma.order.count(),
    sessions: await prisma.session.count(),
    students: await prisma.student.count(),
    spots: await prisma.spot.count(),
    occupied: await prisma.spot.count({ where: { isOccupied: true } }),
    services: await prisma.service.count(),
  };
  say(`deleted: orders=${delOrders.count} sessions=${delSessions.count} students=${delStudents.count}`);
  say(`spots_reset=${resetSpots.count}`);
  say(`after: ${JSON.stringify(after)}`);

  const open = await prisma.session.count({ where: { checkOut: null } });
  say(`active_sessions_after=${open}`);

  await prisma.$disconnect();
  say("RESET done — DB is clean for production.");
}

main().catch((e) => {
  console.error("RESET FAILED:", e?.message ?? e);
  process.exit(1);
});