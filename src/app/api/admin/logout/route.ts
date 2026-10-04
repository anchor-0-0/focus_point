import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, destroySessionToken } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  // حذف العلامة من الخادم: الكوكي تفقد صلاحيتها فوراً في كل الأجهزة.
  destroySessionToken(token);
  cookieStore.delete(ADMIN_COOKIE);

  return NextResponse.json({ ok: true });
}