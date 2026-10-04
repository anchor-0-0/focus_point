#!/usr/bin/env node
// ============================================================
// اختبار حمل: تسجيل دخول متزامن لكثير من الطلاب + تخصيص أماكن
// ------------------------------------------------------------
// الهدف: التأكد من أن التخصيص الآمن (FOR UPDATE SKIP LOCKED في
// public.assign_random_spot) لا يخصّص نفس المكان لطالبين عند
// الضغط المتزامن — وألا يتجاوز عدد الجلسات النشطة عدد الأماكن.
//
// الاستخدام:
//   node scripts/load-test.mjs            # 15 طالباً متزامناً (افتراضي)
//   node scripts/load-test.mjs 30         # 30 طالباً متزامناً
//   node scripts/load-test.mjs 15 studio  # 15 على المراسم
//
// ملاحظة: السكربت ينظّف جداويل students/sessions/orders ويعيد تهيئة
// الأماكن قبل بدء الاختبار — لا تشغّله على قاعدة بيانات إنتاج.
// ============================================================
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const BASE_URL = process.env.LOAD_TEST_URL ?? "http://localhost:3000";
const CONCURRENCY = Number(process.argv[2] ?? 15);
const SPOT_TYPE = process.argv[3] ?? "table";

if (!Number.isInteger(CONCURRENCY) || CONCURRENCY < 2 || CONCURRENCY > 100) {
  console.error("العدد يجب أن يكون عدداً صحيحاً بين 2 و 100");
  process.exit(1);
}
if (SPOT_TYPE !== "table" && SPOT_TYPE !== "studio") {
  console.error("نوع المكان يجب أن يكون table أو studio");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL غير معرّفة في .env.local");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function resetDb() {
  await pool.query(
    "TRUNCATE orders, sessions, students RESTART IDENTITY; UPDATE spots SET is_occupied = false;"
  );
}

async function countActiveSessions() {
  const r = await pool.query(
    "SELECT count(*) FROM sessions WHERE status = 'active'"
  );
  return Number(r.rows[0].count);
}

async function countOccupiedSpots() {
  const r = await pool.query("SELECT count(*) FROM spots WHERE is_occupied");
  return Number(r.rows[0].count);
}

async function duplicateSpotIds() {
  const r = await pool.query(
    "SELECT spot_id, count(*) FROM sessions WHERE status='active' GROUP BY spot_id HAVING count(*) > 1"
  );
  return r.rows;
}

async function request(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function main() {
  console.log(
    `\nاختبار الحمل: ${CONCURRENCY} طالباً متزامناً  (${BASE_URL}, نوع: ${SPOT_TYPE})`
  );
  await resetDb();

  // 1) إنشاء الطلاب بالتوازي
  const checkins = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) =>
      request("/api/checkin", { name: `LoadTest-${i}` })
    )
  );
  const studentIds = checkins
    .filter((r) => r.status === 200 && r.data.ok)
    .map((r) => r.data.student_id);
  const failedCheckins = checkins.filter((r) => r.status !== 200);
  console.log(`إنشاء الطلاب: ${studentIds.length} نجح, ${failedCheckins.length} فشل`);

  if (studentIds.length === 0) {
    console.error("فشل إنشاء كل الطلاب — تأكد أن الخادم يعمل");
    pool.end();
    process.exit(1);
  }

  // 2) تخصيص "طاولة دراسة" بالتوازي دفعة واحدة (نفس لحظة الضغط)
  //    عدد الطاولات في القاعدة 5 — لذا المتوقع نجاح 5 فقط والبقية no_spot.
  const assigns = await Promise.all(
    studentIds.map((sid) =>
      request("/api/assign-spot", { student_id: sid, spot_type: SPOT_TYPE })
    )
  );

  const assigned = assigns.filter((r) => r.status === 200 && r.data.ok);
  const noSpot = assigns.filter((r) => r.data && r.data.no_spot);
  const unexpected = assigns.filter(
    (r) => r.status !== 200 || (!r.data.ok && !r.data.no_spot)
  );

  const spotIds = assigned.map((r) => r.data.spot_id);
  const uniqueSpotIds = new Set(spotIds);

  console.log(`نوع المكان: ${SPOT_TYPE}`);
  console.log(
    `التخصيص: ${assigned.length} نجح, ${noSpot.length} لا يوجد مكان`
  );
  console.log(`أماكن مكررة في الاستجابات: ${spotIds.length - uniqueSpotIds.size}`);

  // 3) التحقق من الحالة الفعلية في قاعدة البيانات
  const active = await countActiveSessions();
  const occupied = await countOccupiedSpots();
  const dupDb = await duplicateSpotIds();

  console.log(`\n— التحقق في قاعدة البيانات —`);
  console.log(`جلسات نشطة: ${active}  (الحد: عدد الأماكن من نوع ${SPOT_TYPE})`);
  console.log(`أماكن مشغولة: ${occupied}`);
  console.log(`أماكن مكرَّرة بين الجلسات (يجب 0): ${dupDb.length}`);

  let failures = [];
  if (spotIds.length !== uniqueSpotIds.size) {
    failures.push("تكرار أماكن في استجابات API (نفس المكان لطالبين)");
  }
  if (dupDb.length > 0) {
    failures.push("تكرار أماكن في قاعدة البيانات بين جلسات نشطة");
  }
  if (assigned.length === 0) {
    failures.push("لم ينجح أي تخصيص");
  }
  if (unexpected.length > 0) {
    failures.push(`استجابات غير متوقعة: ${unexpected.length}`);
  }
  if (active !== occupied) {
    failures.push("جلسة نشطة بلا مكان مشغول أو العكس");
  }
  if (assigned.length !== occupied) {
    failures.push("عدد التخصيصات لا يطابق المشغول في القاعدة (تسجيل زائد؟)");
  }

  if (failures.length === 0) {
    console.log("\n✓ النتيجة: PASS — لا تكرار في التخصيص تحت التزامن");
  } else {
    console.log("\n✗ النتيجة: FAIL");
    for (const f of failures) console.log("  •", f);
  }

  await pool.end();
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});