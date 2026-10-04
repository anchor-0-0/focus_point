// ============================================================
// حذف جميع الملفات المرفوعة (نظافة عامة) — مسار محمي كباقي مسارات
// الأدمن. يُستخدم من زر "حذف كل الملفات" في لوحة الطلبات عبر
// استدعاء POST فقط (لا يمكن حذف المرفوعات من GET).
// ============================================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearAllUploads } from "@/lib/uploads";
import {
  ADMIN_COOKIE,
  isValidSessionCookie,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  if (!isValidSessionCookie(token)) {
    return NextResponse.json(
      { ok: false, error: "غير مصرح بالوصول" },
      { status: 401 }
    );
  }

  try {
    const deleted = await clearAllUploads();
    return NextResponse.json({ ok: true, deleted });
  } catch {
    return NextResponse.json(
      { ok: false, error: "تعذّر حذف الملفات" },
      { status: 500 }
    );
  }
}
