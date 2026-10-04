import { NextResponse } from "next/server";

// ============================================================
// معالجة موحّدة للأخطاء في route handlers.
//
// المشكلة الأصلية: كانت كل route تُعيد (err as Error).message
// للعميل، ما يُسرّب تفاصيل تقنية إنجليزية (أسماء جداول، رسائل
// اتصال قاعدة البيانات...) بدل رسالة عربية واضحة — ويظهر للطالب
// نص غامض عند انقطاع قاعدة البيانات.
//
// القاعدة: لا تعرض أبداً نص الخطأ التقني للعميل. سجّله في وحدة
// التحكم (console) ليراها المطوّر، وأعد رسالة عربية ملائمة
// حسب نوع الخطأ.
// ============================================================

/** تسجيل الخطأ الأصلي في الخادم للتحقق أثناء التطوير. */
export function logError(context: string, err: unknown) {
  console.error(`[api:${context}]`, collectMessages(err) || String(err));
}

/** جمع كل رسائل الخطأ (يدعم الأخطاء المتداخلة مثل AggregateError من node-pg). */
function collectMessages(err: unknown): string {
  if (!err) return "";
  if (Array.isArray((err as { errors?: unknown[] }).errors)) {
    return (err as { errors: unknown[] }).errors
      .map((e) => collectMessages(e))
      .filter(Boolean)
      .join(" | ");
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

/** هل الخطأ سببه انقطاع/فشل الاتصال بقاعدة البيانات؟ */
function isDbConnectionError(err: unknown): boolean {
  if (!err) return false;

  // node-pg يضع رمز الخطأ على AggregatedError أو الخطأ الفردي.
  const code = (err as { code?: string }).code;
  if (
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "EHOSTUNREACH" ||
    code === "ENOTFOUND"
  ) {
    return true;
  }

  const msg = collectMessages(err);
  return /connection.*(refused|terminated|failed|timeout|cannot connect)|can'?t reach database|connection pool timeout|Client has encountered a connection error|could not connect/i.test(
    msg
  );
}

/** رسالة عربية آمنة للعميل مهما كان نوع الخطأ التقني. */
export function safeErrorMessage(
  err: unknown,
  fallback = "حدث خطأ غير متوقع، الرجاء المحاولة مرة أخرى"
): string {
  if (isDbConnectionError(err)) {
    return "تعذّر الاتصال بقاعدة البيانات، الرجاء المحاولة مرة أخرى";
  }
  // حالات معروفة من Prisma: قيد التفرّد/التكرار.
  const msg = collectMessages(err);
  if (msg.includes("Unique constraint") || msg.includes("P2002")) {
    return "القيم المدخلة مكرّرة أو مسجّلة مسبقاً";
  }
  if (msg.includes("Foreign key constraint") || msg.includes("P2003")) {
    return "العنصر مرتبط ببيانات أخرى ولا يمكن تعديله";
  }
  return fallback;
}

/** بناء استجابة JSON خطأ موحّدة مع تسجيل الأصل في الخادم. */
export function jsonError(
  context: string,
  err: unknown,
  status = 500,
  fallback?: string
) {
  logError(context, err);
  return NextResponse.json(
    { ok: false, error: safeErrorMessage(err, fallback) },
    { status }
  );
}