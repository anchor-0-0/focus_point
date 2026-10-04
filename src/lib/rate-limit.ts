// ============================================================
// مقياس معدّلات بسيط في الذاكرة (fixed-window) — حدّ من الإساءة
// بلا قاعدة بيانات. يُخزَّن على globalThis فيعيش عبر إعادة تحميل
// HMR. تنبيه: يعمل داخل العملية الواحدة؛ كافٍ لخادم LAN أحادي
// (next dev / next start)، ويُعاد ضبطه كلياً عند إعادة تشغيل الخادم.
// ============================================================

import { NextResponse } from "next/server";

type Bucket = {
  count: number;
  bytes: number;
  resetAt: number;
};

const globalRef = globalThis as unknown as {
  __fpRateLimits?: Map<string, Bucket>;
  __fpRateLimitLastSweep?: number;
};

function buckets(): Map<string, Bucket> {
  if (!globalRef.__fpRateLimits) globalRef.__fpRateLimits = new Map();
  return globalRef.__fpRateLimits;
}

// تنظيف سلة المهملات دورياً (مرة كل دقيقة وإذا تجاوزت الحجم مئة) حتى
// لا تكبر الخريطة إلى ما لا نهاية مع مفاتيح مختلفة لكل جلسة.
function sweep() {
  const map = buckets();
  const now = Date.now();
  const last = globalRef.__fpRateLimitLastSweep ?? 0;
  if (now - last < 60_000) return;
  globalRef.__fpRateLimitLastSweep = now;
  if (map.size < 100) return;
  for (const [key, bucket] of map) {
    if (now >= bucket.resetAt) map.delete(key);
  }
}

export type RateLimitOutcome = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

/** قياس بسيط بعدد الطلبات داخل نافذة زمنية. */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitOutcome {
  sweep();
  const map = buckets();
  const now = Date.now();
  const bucket = map.get(key);

  if (!bucket || now >= bucket.resetAt) {
    map.set(key, { count: 1, bytes: 0, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}

export type WeightedLimits = {
  maxCount: number;
  maxBytes: number;
  windowMs: number;
};

/**
 * قياس مرجّح: يضبط حدّاً فوق عدد الطلبات وأيضاً فوق كمية بايت تجمّعية
 * (استخدام فعلي: حدود الرفع لكل جلسة — لا ملفات أكثر من حد ولا بايتات
 * أزيد من حصة للقرص داخل الساعة).
 */
export function checkWeightedRateLimit(
  key: string,
  limits: WeightedLimits,
  bytesToAdd: number
): RateLimitOutcome {
  sweep();
  const map = buckets();
  const now = Date.now();
  let bucket = map.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, bytes: 0, resetAt: now + limits.windowMs };
    map.set(key, bucket);
  }

  if (bucket.count + 1 > limits.maxCount || bucket.bytes + bytesToAdd > limits.maxBytes) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  bucket.bytes += bytesToAdd;
  return {
    allowed: true,
    remaining: Math.max(0, limits.maxCount - bucket.count),
    retryAfterMs: 0,
  };
}

/** استجابة 429 جاهزة مع Retry-After بالثواني. */
export function rateLimitResponse(retryAfterMs: number, message: string): NextResponse {
  return NextResponse.json(
    { ok: false, error: message },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) },
    }
  );
}