import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getServerLang } from "@/lib/server-lang";
import { translate, type DictKey } from "@/lib/i18n";
import { AdminChrome } from "./AdminChrome";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
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