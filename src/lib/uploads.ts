// ============================================================
// رفع/تخزين ملفات الطباعة محلياً على القرص
// ------------------------------------------------------------
// - المجلد خارج مجلد المشروع عند الإمكان (عبر UPLOAD_DIR في
//   .env.local)، مع fallback آمن نحو <المشروع>/uploads (gitignored).
// - الأسماء المخزنة فريدة: <uuid>.<الامتداد الأصلي> لتفادي التعارض.
// - لا يُخدم هذا المجلد أبداً كمسار ثابت (public) — الوصول يتم فقط
//   عبر route handler محمي (نفس حماية /admin).
// - حماية المسار: resolveStoredPath يرفض أي اسم يحوي مكونات مسار
//   (.. أو فواصل) لمنع تشكيل مسار خارج مجلد الرفع.
// ============================================================

import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_TYPES_UI,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
  extensionOf,
  isAllowedExtension,
  mimeForExtension,
} from "@/lib/upload-policy";

export {
  ALLOWED_EXTENSIONS,
  ALLOWED_TYPES_UI,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
  extensionOf,
  isAllowedExtension,
  mimeForExtension,
};

export function getUploadsDir(): string {
  const fromEnv = process.env.UPLOAD_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  // fallback داخل المشروع (مُضاف لـ .gitignore)
  return path.join(process.cwd(), "uploads");
}

export async function ensureUploadsDir(): Promise<string> {
  const dir = getUploadsDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

/** تحويل الاسم المخزن (uuid.ext) إلى مسار مطلق آمن داخل مجلد الرفع.
 * يرمي في حال احتوى الاسم على مكونات مسار (رفضاً للـ path traversal).
 */
export function resolveStoredPath(storedName: string): string {
  const base = path.basename(storedName);
  if (base !== storedName || base === "." || base === "..") {
    throw new Error("invalid stored file name");
  }
  return path.join(getUploadsDir(), base);
}

export type SavedUpload = {
  storedName: string;
  originalName: string;
  mime: string;
  size: number;
};

/**
 * حفظ ملف مرفوع بأمان: التحقق من الامتداد والحجم، ثم الكتابة باسم
 * فريد (uuid + الامتداد الأصلي). يعود بمعلومات الملف المخزَّن.
 * يرمي خطأ (Error) برسالة مناسبة عند الرفض.
 */
export async function saveUploadedFile(file: File): Promise<SavedUpload> {
  if (!isAllowedExtension(file.name)) {
    throw new Error(
      `نوع الملف غير مسموح. الأنواع المدعومة: ${ALLOWED_TYPES_UI}`
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `حجم الملف يتجاوز الحد الأقصى (${MAX_FILE_MB} ميغابايت)`
    );
  }

  const dir = await ensureUploadsDir();
  const storedName = `${randomUUID()}.${extensionOf(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(path.join(dir, storedName), buffer);

  return {
    storedName,
    originalName: file.name,
    mime: file.type || mimeForExtension(file.name),
    size: file.size,
  };
}

/** قائمة بأسماء الملفات المخزَّنة حالياً في مجلد الرفع. */
export async function listStoredUploads(): Promise<string[]> {
  const dir = await ensureUploadsDir();
  try {
    const names = await readdir(dir);
    return names.filter((n) => {
      const base = path.basename(n);
      return base === n && base !== "." && base !== "..";
    });
  } catch {
    return [];
  }
}

/** حذف كل الملفات المخزَّنة في مجلد الرفع. يعود بعدد المحذوف. */
export async function clearAllUploads(dir?: string): Promise<number> {
  const target = dir ?? (await ensureUploadsDir());
  const names = await listStoredUploads().catch(() => []);
  let removed = 0;
  for (const n of names) {
    try {
      await rm(path.join(target, path.basename(n)), { force: true });
      removed++;
    } catch {
      // تجاهل أي ملف عجزنا عن حذفه واستمر.
    }
  }
  return removed;
}