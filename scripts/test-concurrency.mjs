#!/usr/bin/env node
// ============================================================
// StudyZone - Concurrency test for /api/assign-spot
// ============================================================
// يحاكي عدة طلاب يضغطون "نفس نوع المكان" بنفس اللحظة تقريباً،
// ويتأكد أن كل واحد اخذ spot مختلف (لا تعارض).
//
// الاستخدام (بعد تشغيل npm run dev):
//   node scripts/test-concurrency.mjs
// ============================================================

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SPOT_TYPE = process.env.SPOT_TYPE ?? "table"; // table | studio
const COUNT = Number(process.env.COUNT ?? 5);

async function createStudent(name, phone) {
  const res = await fetch(`${BASE}/api/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, phone }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`checkin failed for ${name}: ${data.error}`);
  return data.student_id;
}

async function assignSpot(studentId) {
  const res = await fetch(`${BASE}/api/assign-spot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: studentId, spot_type: SPOT_TYPE }),
  });
  const data = await res.json();
  return data;
}

async function run() {
  console.log(`Starting concurrency test: ${COUNT} students on type="${SPOT_TYPE}"`);

  const studentIds = [];
  for (let i = 0; i < COUNT; i++) {
    studentIds.push(await createStudent(`طالب تزامن ${i}`, `9${i}${i}${i}${i}`));
  }

  console.log(`Created ${studentIds.length} students. Assigning spots concurrently...`);

  // جمع كل الاستدعاءات بمحاذاة واحدة -> تنفيذ متزامن
  const results = await Promise.all(studentIds.map(assignSpot));

  const ok = results.filter((r) => r.ok);
  const noSpot = results.filter((r) => r.no_spot);
  const failed = results.filter((r) => !r.ok && !r.no_spot);

  console.log(`\n--- النتائج ---`);
  console.log(`نجح التخصيص: ${ok.length}`);
  console.log(`لا يوجد مكان متاح: ${noSpot.length}`);
  console.log(`أخطاء: ${failed.length}`);

  // فحص التعارض: هل تكرر نفس الـ spot أكثر من مرة؟
  const spotCounts = {};
  ok.forEach((r) => {
    spotCounts[r.spot_id] = (spotCounts[r.spot_id] ?? 0) + 1;
  });

  const duplicates = Object.entries(spotCounts).filter(([, c]) => c > 1);
  const assignedSpots = Object.keys(spotCounts).length;

  console.log(`\nأماكن مختلفة تم تخصيصها: ${assignedSpots}`);
  if (duplicates.length > 0) {
    console.error(`\n*** تعارض! نفس المكان تم تخصيصه لأكثر من طالب: ${JSON.stringify(duplicates)}`);
    process.exit(1);
  }

  const expectedUnique = Math.min(COUNT, ok.length + noSpot.length);
  if (assignedSpots !== ok.length) {
    console.error(`\n*** تعارض محتمل: ${assignedSpots} أماكن فريدة مقابل ${ok.length} عملية نجحت`);
    process.exit(1);
  }

  console.log(`\n✔ لا يوجد تعارض — كل واحد اخذ مكان مختلف.`);
  console.log(`لمعرفة عدد الأماكن الكلية لنوع "${SPOT_TYPE}" شغّل على قاعدة البيانات:`);
  console.log(`  select count(*) from public.spots where type='${SPOT_TYPE}' and is_occupied=false;`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
