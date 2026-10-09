// ============================================================
// منطق الخصم المشترك (خادوم + عميل) — Focus Point.
// ------------------------------------------------------------
// قواعد صارمة (يتحقق منها الخادوم دائماً قبل الحفظ، والواجهة
// تستعملها نفسها للعرض اللحظي):
//   - النطاق: 'total' (الفاتورة كاملة) | 'hours' (رسوم الساعات)
//     | 'orders' (سعر الطلبات/الخدمات).
//   - النوع: 'percent' نسبة 0..100 | 'fixed' مبلغ ثابت |
//     'free_hours' ساعات مجانية (لأنطاق "hours" فقط).
//   - القيمة غير سالبة، والنسبة ≤ 100، والخصم لا يتجاوز المبلغ
//     الذي يُخصم منه (أي المجموع النهائي لا يقل عن صفر).
//   - أي مخالفة تُرجع رمز خطأ واضح (يترجم في الواجهة ويُعرض
//     كرسالة عربية في الـ API).
// ============================================================

export type DiscountScope = "total" | "hours" | "orders";
export type DiscountType = "percent" | "fixed" | "free_hours";

export const DISCOUNT_SCOPES: DiscountScope[] = ["total", "hours", "orders"];
export const DISCOUNT_TYPES: DiscountType[] = ["percent", "fixed", "free_hours"];

/** أخطاء الخصم برموز قابلة للترجمة. */
export type DiscountErrorCode =
  | "invalid_scope"
  | "invalid_type"
  | "invalid_value"
  | "negative"
  | "percent_range"
  | "free_hours_scope"
  | "exceeds_base";

export type DiscountInput = {
  scope: DiscountScope;
  type: DiscountType;
  value: number;
  note?: string | null;
};

/** المبالغ المرجعية للفاتورة قبل الخصم. */
export type DiscountBases = {
  /** الساعات المحتسبة (حد أدنى ساعة). */
  billableHours: number;
  /** سعر الساعة المُطبَّق. */
  hourlyRate: number;
  /** رسوم الجلسة بالساعات قبل الخصم. */
  hoursAmount: number;
  /** مجموع الطلبات المنفّذة (done) قبل الخصم. */
  ordersAmount: number;
};

export type DiscountComputation = {
  scope: DiscountScope;
  type: DiscountType;
  value: number;
  /** القيمة الفعلية المخصومة بالليرة (مقرّبة لمنزلتين). */
  amount: number;
  note: string | null;
  /** المبلغ النهائي بعد الخصم. */
  finalAmount: number;
};

/** تقريب لمنزلتين عشرية (المبالغ بالليرة). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** رسالة عربية جاهزة لرمز الخطأ (تُستخدم في ردود الـ API). */
export function discountErrorText(code: DiscountErrorCode): string {
  switch (code) {
    case "invalid_scope":
      return "نطاق خصم غير صالح";
    case "invalid_type":
      return "نوع خصم غير صالح";
    case "invalid_value":
      return "قيمة خصم غير صالحة";
    case "negative":
      return "قيمة الخصم لا يمكن أن تكون سالبة";
    case "percent_range":
      return "النسبة المئوية يجب أن تكون بين 0 و 100";
    case "free_hours_scope":
      return "الخصم بالساعات المجانية متاح لرسوم الساعات فقط";
    case "exceeds_base":
      return "قيمة الخصم تتجاوز المبلغ الذي يُخصم منه";
  }
}

export type DiscountValidation =
  | { ok: true; discount: DiscountComputation }
  | { ok: false; code: DiscountErrorCode };

/**
 * التحقق من الخصم وإعادة حسابه من الأرقام الأساسية.
 * لا تثق بأي رقم قادم من الواجهة — انادِ هذه الدالة دائماً بالسيرفر.
 */
export function computeDiscount(
  input: DiscountInput,
  bases: DiscountBases
): DiscountValidation {
  const scope = input.scope;
  const type = input.type;
  const value = input.value;

  if (!DISCOUNT_SCOPES.includes(scope)) {
    return { ok: false, code: "invalid_scope" };
  }
  if (!DISCOUNT_TYPES.includes(type)) {
    return { ok: false, code: "invalid_type" };
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, code: "invalid_value" };
  }
  if (value < 0) {
    return { ok: false, code: "negative" };
  }
  if (type === "free_hours" && scope !== "hours") {
    return { ok: false, code: "free_hours_scope" };
  }

  const hoursAmount = round2(Math.max(0, bases.hoursAmount));
  const ordersAmount = round2(Math.max(0, bases.ordersAmount));
  const total = round2(hoursAmount + ordersAmount);
  const base = scope === "total" ? total : scope === "hours" ? hoursAmount : ordersAmount;

  let amount = 0;
  if (type === "percent") {
    if (value > 100) return { ok: false, code: "percent_range" };
    amount = round2((base * value) / 100);
  } else if (type === "fixed") {
    amount = round2(value);
  } else {
    // ساعات مجانية: القيمة عدد ساعات × سعر الساعة، ولا تتجاوز
    // الساعات المحتسبة وإلا تجاوزت الخصم رسوم الجلسة.
    const rate = Number.isFinite(bases.hourlyRate) && bases.hourlyRate > 0
      ? bases.hourlyRate
      : 0;
    if (value > bases.billableHours) {
      return { ok: false, code: "exceeds_base" };
    }
    amount = round2(value * rate);
  }

  if (amount > base + 0.005) {
    return { ok: false, code: "exceeds_base" };
  }
  amount = Math.min(amount, base);

  const finalAmount = round2(Math.max(0, total - amount));
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 200) : null;

  return {
    ok: true,
    discount: {
      scope,
      type,
      value: round2(value),
      amount,
      note: note || null,
      finalAmount,
    },
  };
}
