import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidSessionCookie } from "@/lib/admin-auth";

// تحقق من جلسة المدير في Server Component / Layout.
// عند الفشل يعيد توجيه لصفحة الدخول.
export async function requireAdminOrRedirect() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  if (!isValidSessionCookie(token)) {
    redirect("/admin/login");
  }
}

// تحقق من جلسة المدير داخل Route Handler.
// عند الفشل يعيد JSON 401.
export async function requireAdminJson() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  if (!isValidSessionCookie(token)) {
    return NextResponse.json(
      { ok: false, error: "غير مصرح. الرجاء تسجيل الدخول." },
      { status: 401 }
    );
  }

  return null;
}