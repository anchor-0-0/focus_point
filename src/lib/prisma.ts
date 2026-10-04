import { config } from "dotenv";
import { PrismaClient } from "../../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// يُحمَّل .env.local (نفس ملف Next.js) عند تشغيل الوحدة خارج إطار
// Next.js، مثل: prisma db seed أو scripts مستقلة. داخل Next.js يُحمَّل
// تلقائياً، وهنا لا ضرر من التحميل المكرر.
config({ path: ".env.local" });

// ============================================================
// طبقة الوصول إلى قاعدة البيانات عبر Prisma Client (Prisma 7).
//
// Prisma 7 يستخدم "driver adapters": ينشأ العميل مع مُهايئ PrismaPg
// الذي يقرأ DATABASE_URL. لا توجد طبقة أمان/RLS على مستوى قاعدة
// البيانات (PostgreSQL محلي فقط) — أي تحقق من الصلاحيات يجب أن
// يتم يدوياً داخل route handlers/server actions.
//
// ⚠ الحماية اليدوية المطلوبة في route handlers:
//   — لا يوجد RLS (Postgres Row Level Security) ولا policies لمستخدم
//     Supabase. قاعدة البيانات متاحة مباشرة عبر الاتصال.
//   — لذلك أي عملية حساسة (إنشاء طلب، إنهاء جلسة، عمليات أدمن) يجب
//     أن تتحقق أولاً يدوياً: الجلسة موجودة؟ نشطة؟ ومَن صاحبها؟ ومن
//     أين جاء الطلب؟ (مثلاً: تحقق أن الطلب من صفحة أدمن محمية).
//   — قبل كتابة أي handler جديد: أعد فحص هذه النقطة ولا تفترض وجود
//     حماية على مستوى الـ DB.
//
// ⚠ المنطقة الزمنية (Timezone):
//   أُجبر اتصال pg على timezone=UTC صراحة. السبب: @prisma/adapter-pg
//   يكتب قيم DateTime الناتجة من العميل (new Date()) على هيئة نص بلا
//   مؤشر منطقة، فلو بقيت الجلسة بمنطقة محلية (مثل Asia/Damascus) تُفسَّر
//   القيمة UTC كما لو كانت "محلية" وينحرف المخزن (-3h في حالة دمشق).
//   بفرض UTC: تُخزَّن كل الأزمنة بالتوقيت المطلق (UTC) ويبقى أي تحويل
//   للمنطقة للمعروض/الحسابات (مثل "إيرادات اليوم") داخل الاستعلام.
//
// نُبقي نسخة واحدة (singleton) من العميل عبر الوحدات في بيئة
// التطوير (globalThis) لمنع استنزاف الاتصالات عند إعادة التقييم.
// ============================================================

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL غير معرّفة. انسخ .env.local.example واضبط القيم في .env.local"
  );
}

/** المُهايئ يُبنى مرة واحدة على مستوى الوحدة (connection بمنطقة UTC). */
const pool = new pg.Pool({
  connectionString,
  options: "-c timezone=UTC",
});
const adapter = new PrismaPg(pool);

function createClient() {
  return new PrismaClient({ adapter });
}

declare global {
  var __focus_point_prisma: ReturnType<typeof createClient> | undefined;
}

// singleton: في التطوير يعيد Next تقييم الوحدة، فنعيد استخدام الموجود
export const prisma: ReturnType<typeof createClient> =
  globalThis.__focus_point_prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__focus_point_prisma = prisma;
}