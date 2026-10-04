// DB-level verification (read-only) — uses the project's generated Prisma client
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/prisma/client";

config({ path: ".env.local" });

const say = (s: unknown = "") => console.log(s);

async function main() {
  const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
  const prisma = new PrismaClient({ adapter: pool });

  const v = (await prisma.$queryRaw`SELECT version() AS v`) as { v: string }[];
  say(`postgres=${v[0].v.split(" ").slice(0, 2).join(" ")}`);

  say(
    `rows: spots=${await prisma.spot.count()} students=${await prisma.student.count()} ` +
      `sessions=${await prisma.session.count()} orders=${await prisma.order.count()}`
  );

  const byStatus = await prisma.order.groupBy({ by: ["status"], _count: { _all: true } });
  say(`orders_by_status=${byStatus.map((o) => `${o.status}:${o._count._all}`).join(" ")}`);

  const active = await prisma.session.findMany({
    where: { checkOut: null },
    select: {
      id: true,
      checkIn: true,
      student: { select: { name: true } },
        spot: { select: { seatNumber: true, seatGroup: true, room: true } },
    },
    orderBy: { checkIn: "asc" },
  });
  say(`active_sessions=${active.length}`);
  for (const s of active) {
    say(`  ${s.student.name} | ${s.spot?.seatGroup}/${s.spot?.seatNumber} (${s.spot?.room}) | ${s.checkIn.toISOString()}`);
  }

  const cols = (await prisma.$queryRaw`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders' ORDER BY ordinal_position`) as {
    column_name: string;
    data_type: string;
  }[];
  say(`order_columns=${cols.map((c) => `${c.column_name}:${c.data_type}`).join(" ")}`);

  const dupes = (await prisma.$queryRaw`
    SELECT sp."seat_group" AS gid, sp."seat_number" AS seat, COUNT(*)::int AS n
    FROM "sessions" s JOIN "spots" sp ON sp.id = s."spot_id"
    WHERE s."check_out" IS NULL GROUP BY sp."seat_group", sp."seat_number" HAVING COUNT(*) > 1`) as unknown[];
  say(`double_occupied_spots=${Array.isArray(dupes) ? dupes.length : 0}`);
  if (Array.isArray(dupes) && dupes.length) say(`  ${JSON.stringify(dupes)}`);

  const flagMismatch = (await prisma.$queryRaw`
    SELECT sp.id::text AS spot, sp."is_occupied" AS flag
    FROM "spots" sp
    WHERE sp."is_occupied" <> EXISTS (SELECT 1 FROM "sessions" s WHERE s."spot_id" = sp.id AND s."check_out" IS NULL)`) as unknown[];
  say(`occupancy_flag_mismatch=${Array.isArray(flagMismatch) ? flagMismatch.length : 0}`);
  if (Array.isArray(flagMismatch) && flagMismatch.length) say(`  ${JSON.stringify(flagMismatch)}`);

  const dupSpots = (await prisma.$queryRaw`
    SELECT "seat_group" AS gid, "seat_number" AS seat, COUNT(*)::int AS n
    FROM "spots" GROUP BY 1,2 HAVING COUNT(*) > 1`) as unknown[];
  say(`duplicate_spot_rows=${Array.isArray(dupSpots) ? dupSpots.length : 0}`);
  if (Array.isArray(dupSpots) && dupSpots.length) say(`  ${JSON.stringify(dupSpots)}`);

  const perSpot = (await prisma.$queryRaw`
    SELECT sp.id::text AS spot_id, sp."seat_group" AS gid, sp."seat_number" AS seat,
           sp."is_occupied" AS flag, COUNT(s.id)::int AS sessions
    FROM "spots" sp
    LEFT JOIN "sessions" s ON s."spot_id" = sp.id AND s."check_out" IS NULL
    GROUP BY sp.id HAVING COUNT(s.id) > 1`) as unknown[];
  say(`spots_with_multiple_active_sessions=${Array.isArray(perSpot) ? perSpot.length : 0}`);
  if (Array.isArray(perSpot) && perSpot.length) say(`  ${JSON.stringify(perSpot)}`);

  const openOrders = await prisma.order.findMany({
    where: { status: "pending" },
    select: { id: true, createdAt: true, session: { select: { checkOut: true, student: { select: { name: true } } } } },
  });
  say(`pending_orders=${openOrders.length}`);
  for (const o of openOrders) {
    say(`  ${o.session.student.name} | session_closed=${o.session.checkOut !== null} | ${o.createdAt.toISOString()}`);
  }

  const orphanOpen = openOrders.filter((o) => o.session.checkOut !== null);
  say(`pending_orders_on_ended_sessions=${orphanOpen.length}`);

  await prisma.$disconnect();
  say("DB-VERIFY done");
}

main().catch((e) => {
  console.error("DB-VERIFY FAILED:", e?.message ?? e);
  process.exit(1);
});
