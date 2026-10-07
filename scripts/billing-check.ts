// ============================================================
// اختبارات دالة احتساب الأجر في src/lib/billing.ts
// التشغيل: npx tsx scripts/billing-check.ts
// ============================================================
import { computeBilling, DEFAULT_HOURLY_RATE_SYP } from "../src/lib/billing";

const RATE = DEFAULT_HOURLY_RATE_SYP;
// قاعدة زمنية ثابتة للاستقرار.
const BASE = new Date("2026-01-01T00:00:00.000Z").getTime();
const at = (minutes: number) => new Date(BASE + minutes * 60_000);

type Case = {
  label: string;
  minutes: number;
  hours: number;
  amount: number;
};

const cases: Case[] = [
  // الأمثلة الأربعة المعتمدة من صاحب المكان.
  {
    label: "0:20  → حد أدنى ساعة كاملة",
    minutes: 20,
    hours: 1,
    amount: 10_000,
  },
  { label: "1:25  → ساعة واحدة (الزائد 25 دقيقة ≤ 30)", minutes: 85, hours: 1, amount: 10_000 },
  { label: "1:30  → ساعة واحدة (الزائد 30 دقيقة يُهمل تماماً)", minutes: 90, hours: 1, amount: 10_000 },
  { label: "1:31  → ساعتان (الزائد 31 دقيقة → ساعة إضافية)", minutes: 91, hours: 2, amount: 20_000 },
  // حدود حساسة إضافية.
  { label: "0:00  → جلسة صفرية تُحتسب ساعة حد أدنى", minutes: 0, hours: 1, amount: 10_000 },
  { label: "0:30  → ساعة حد أدنى (دقيقة الحدود لا تُضاف)", minutes: 30, hours: 1, amount: 10_000 },
  { label: "0:31  → ساعة واحدة (قاعدة الزائد: 31 دقيقة = ساعة على صفر)", minutes: 31, hours: 1, amount: 10_000 },
  { label: "0:59  → ساعة حد أدنى (أقل من ساعة كاملة)", minutes: 59, hours: 1, amount: 10_000 },
  { label: "2:05  → ساعتان", minutes: 125, hours: 2, amount: 20_000 },
  { label: "2:30  → ساعتان", minutes: 150, hours: 2, amount: 20_000 },
  { label: "2:31  → 3 ساعات", minutes: 151, hours: 3, amount: 30_000 },
  { label: "خرج قبل الدخول → يُعامل كصفر → ساعة حد أدنى", minutes: -10, hours: 1, amount: 10_000 },
];

// ترتيب عكسي (checkOut قبل checkIn — بيانات تالفة) يُعامل كمدة صفرية → حد أدنى ساعة.
const reversed: Case = { label: "عكس الاتجاه (checkOut أصغر) → يُعامل كصفر → ساعة حد أدنى", minutes: 91, hours: 1, amount: 10_000 };

let failed = 0;

function expect(label: string, actual: { totalMinutes: number; billableHours: number; amount: number }, expected: { totalMinutes: number; billableHours: number; amount: number }) {
  const ok =
    actual.totalMinutes === expected.totalMinutes &&
    actual.billableHours === expected.billableHours &&
    actual.amount === expected.amount;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      `  →  دقائق: ${actual.totalMinutes} | ساعات: ${actual.billableHours} | مبلغ: ${actual.amount}`
  );
  if (!ok) {
    failed++;
    console.error(`      المتوقع: ${expected.totalMinutes} د | ${expected.billableHours} س | ${expected.amount}`);
  }
}

for (const c of cases) {
  const r = computeBilling(at(0), at(c.minutes), RATE);
  expect(c.label, r, { totalMinutes: Math.max(0, c.minutes), billableHours: c.hours, amount: c.amount });
}

{
  const r = computeBilling(at(reversed.minutes), at(0), RATE);
  expect(reversed.label, r, { totalMinutes: 0, billableHours: reversed.hours, amount: reversed.amount });
}

// سعر مخصّص يجب أن يضرب الساعات به مباشرة.
{
  const r = computeBilling(at(0), at(91), 5_000);
  expect("سعر مخصص 5,000 → 2 ساعات = 10,000", r, { totalMinutes: 91, billableHours: 2, amount: 10_000 });
}

if (failed > 0) {
  console.error(`\nفشل ${failed} اختبارات في billing.`);
  process.exit(1);
}
console.log("\nكل اختبارات احتساب الأجر نجحت.");