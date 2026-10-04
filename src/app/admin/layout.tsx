import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { translate, langFromValue, LANG_COOKIE, type DictKey } from "@/lib/i18n";
import { AdminChrome } from "./AdminChrome";

export async function generateMetadata(): Promise<Metadata> {
  const store = await cookies();
  const lang = langFromValue(store.get(LANG_COOKIE)?.value);
  const t = (k: DictKey) => translate(k, lang);
  return {
    title: {
      default: t("admin.chrome.label"),
      template: "%s | Focus Point",
    },
  };
}

// ملاحظة: الحماية تُطبَّق في صفحات الأقسام عبر requireAdminOrRedirect
// (صفحة /admin/login نفسها يجب أن تبقى عامة ليدخل المستخدم).
// هيكل لوحة التحكم (الشريط الجانبي/الهيدر) مخفي تلقائياً على صفحة الدخول.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminChrome>{children}</AdminChrome>;
}