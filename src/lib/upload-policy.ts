// ============================================================
// سياسة رفع ملفات الطباعة — ثوابت/دوال خالصة (بلا imports من Node)
// ------------------------------------------------------------
// هذا الملف آمن للاستيراد من مكونات العميل (use client) — أي شيء
// يحتاج node:crypto أو node:fs يبقى في src/lib/uploads.ts (خادم فقط).
// ============================================================

/** الحد الأقصى لحجم الملف المرفوع: 20MB. */
export const MAX_FILE_MB = 20;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

/** الامتدادات المسموحة (PDF + صور + مستندات Office). */
export const ALLOWED_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
] as const;

/** عرض توضيحي للأنواع المسموحة في واجهة الطالب. */
export const ALLOWED_TYPES_UI = "PDF, JPG, PNG, DOC, DOCX, XLS, XLSX, PPT, PPTX";

/** استخراج الامتداد (بلا نقطة) بأحرف سفلية من اسم ملف. */
export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase();
}

export function isAllowedExtension(filename: string): boolean {
  const ext = extensionOf(filename);
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

/** MIME معروف للعرض/التحميل عبر route محمي. */
export function mimeForExtension(filename: string): string {
  const ext = extensionOf(filename);
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return map[ext] ?? "application/octet-stream";
}