// ============================================================
// بنية حقل `details` في جدول orders (jsonb)
// ------------------------------------------------------------
// تفاصيل واحدة مرنة لكل أنواع الطلبات:
//   عام:
//     quantity      → كمية خدمة (مشروبات وخدمات أخرى)
//     note          → ملاحظة نصية اختيارية
//
//   مشروبات (شاي/قهوة):
//     sugar         → مستوى السكر (لشاي/قهوة؛ عصير لا يحمل حقلاً للسكر)
//
//   طباعة (عبر /api/orders/print مع رفع ملف):
//     file_name     → اسم الملف الأصلي على جهاز الطالب
//     file_path     → الاسم المخزن على القرص (uuid.الامتداد) داخل مجلد الرفع
//     file_type     → MIME
//     file_size     → الحجم بالبايت
//     print_type    → 'black_white' | 'color'
//     copies        → عدد النسخ
//     paper         → 'a4' | 'booklet'
//     print_mode    → 'single_side' | 'double_side'
//     orientation   → 'portrait' | 'landscape'
// ============================================================

export type SugarLevel = "بدون سكر" | "سكر خفيف" | "سكر متوسط" | "سكر زيادة";

export const SUGAR_LEVELS: SugarLevel[] = [
  "بدون سكر",
  "سكر خفيف",
  "سكر متوسط",
  "سكر زيادة",
];

export type PrintType = "black_white" | "color";
export type PaperSize = "a4" | "booklet";
export type PrintMode = "single_side" | "double_side";
export type PrintOrientation = "portrait" | "landscape";

export const PRINT_TYPE_LABELS: Record<PrintType, string> = {
  black_white: "أبيض وأسود",
  color: "ملوّن",
};

export const PAPER_LABELS: Record<PaperSize, string> = {
  a4: "A4",
  booklet: "Booklet",
};

export const PRINT_MODE_LABELS: Record<PrintMode, string> = {
  single_side: "وجه واحد",
  double_side: "وجهين",
};

export const ORIENTATION_LABELS: Record<PrintOrientation, string> = {
  portrait: "عمودي",
  landscape: "أفقي",
};

/**
 * عدد الوحدات المُسعَّرة للطلب: كمية المشروبات، أو عدد نسخ الطباعة.
 * الطلب بلا أي منهما = وحدة واحدة. أي قيمة غير صالحة تُعتبر وحدة.
 */
export function orderUnits(details: OrderDetails | null | undefined): number {
  const d = details ?? {};
  const raw =
    typeof d.quantity === "number"
      ? d.quantity
      : typeof d.copies === "number"
        ? d.copies
        : 1;
  const units = Math.trunc(raw);
  return Number.isFinite(units) && units > 0 ? units : 1;
}

/** إجمالي الطلب = سعر الوحدة × عدد الوحدات. */
export function orderTotal(
  unitPrice: number,
  details: OrderDetails | null | undefined
): number {
  return unitPrice * orderUnits(details);
}

export type OrderDetails = {
  note?: string;
  quantity?: number;

  // مشروبات
  sugar?: SugarLevel;

  // طباعة (بما فيها ملف الرفع)
  file_name?: string;
  file_path?: string;
  file_type?: string;
  file_size?: number;
  print_type?: PrintType;
  copies?: number;
  paper?: PaperSize;
  print_mode?: PrintMode;
  orientation?: PrintOrientation;
};