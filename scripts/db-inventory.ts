// Inventory (read-only) — helps distinguish test rows before reset
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/prisma/client";

config({ path: ".env.local" });

const say = (s: unknown = "") => console.log(s);

async function main() {
  const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
  const prisma = new PrismaClient({ adapter: pool });

  const students = (await prisma.$queryRaw`
    SELECT s.name, MIN(ses."check_in") AS first_in, MAX(ses."check_in") AS last_in, COUNT(ses.id)::int AS sessions
    FROM students s LEFT JOIN sessions ses ON ses."student_id" = s.id
    GROUP BY s.id, s.name ORDER BY first_in NULLS LAST`) as { name: string; first_in: Date | null; last_in: Date | null; sessions: number }[];
  say(`students=${students.length}`);
  for (const s of students) {
    const t1 = s.first_in ? s.first_in.toISOString() : "-";
    const t2 = s.last_in ? s.last_in.toISOString() : "-";
    say(`  ${s.name} | first=${t1} | last=${t2} | sessions=${s.sessions}`);
  }

  const orders = (await prisma.$queryRaw`
    SELECT o.status, svc.name AS service, COUNT(*)::int AS n,
           MIN(o."created_at") AS min_dt, MAX(o."created_at") AS max_dt
    FROM orders o LEFT JOIN services svc ON svc.id = o."service_id"
    GROUP BY o.status, svc.name ORDER BY o.status, svc.name`) as unknown[];
  say("orders_by_status_service:");
  for (const o of orders) say(`  ${JSON.stringify(o)}`);

  const svc = await prisma.service.findMany({ select: { id: true, name: true, category: true, price: true }, orderBy: { name: "asc" } });
  say(`services=${svc.length}`);
  for (const s of svc) say(`  ${s.category} | ${s.name} | ${s.price}`);
  say(`services_count=${svc.length}`);

  await prisma.$disconnect();
  say("INVENTORY done");
}

main().catch((e) => {
  console.error("INVENTORY FAILED:", e?.message ?? e);
  process.exit(1);
});