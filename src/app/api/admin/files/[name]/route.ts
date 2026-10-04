import { cookies } from "next/headers";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidSessionCookie } from "@/lib/admin-auth";
import { mimeForExtension, resolveStoredPath } from "@/lib/uploads";

export const dynamic = "force-dynamic";

// ============================================================
// عرض/تحميل ملفات الطباعة المرفوعة — موصَل محمي
// ------------------------------------------------------------
// يتطلب نفس حماية لوحة التحكم (/admin). بدون كوكي جلسة أدمن صالحة
// لا يُعرض الملف. المسار يُحل عبر اسم مخزَّن فقط (uuid.امتداد) مع
// رفض أي مكونات مسار، فلا يكشف التطبيق مجلد الرفع مباشرة.
// ============================================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  if (!isValidSessionCookie(token)) {
    return new NextResponse("غير مصرح بالوصول", { status: 401 });
  }

  const { name } = await params;

  let filePath: string;
  try {
    filePath = resolveStoredPath(name);
  } catch {
    return new NextResponse("اسم الملف غير صالح", { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const download = searchParams.get("download") === "1";
  const originalName = searchParams.get("name")?.trim() ?? name;

  try {
    const data = await readFile(filePath);

    return new NextResponse(data, {
      headers: {
        "Content-Type": mimeForExtension(name),
        "Content-Length": String(data.byteLength),
        "Cache-Control": "private, no-store",
        // A6: يمنع المتصفح من "تخمين" نوع المحتوى من محتوى الاستجابة
        // (يفشل أي هجوم يُرفع فيه HTML داخل ملف .pdf ليُعرض نصاً).
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": download
          ? `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`
          : "inline",
      },
    });
  } catch {
    return new NextResponse("الملف غير موجود على القرص", { status: 404 });
  }
}