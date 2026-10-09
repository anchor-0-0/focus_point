"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminNav, AdminNavCompact, LogoutIconButton } from "./AdminNav";
import { HospitalityQuickLogButton } from "./HospitalityQuickLog";
import { NewOrdersWatcher } from "./NewOrdersWatcher";
import { useI18n } from "@/components/LanguageProvider";

// هيكل لوحة التحكم (شريط جانبي + هيدر + تنقل).
// — على صفحة /admin/login لا نعرض الهيكل إطلاقاً (الزائر ليس مديراً):
//   شريط جانبي وأزرار خروج/تنقل بلا معنى، والصفحة يجب أن تبقى نظيفة.
export function AdminChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const isLogin = pathname === "/admin/login";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      {/* مراقب الطلبات الجديدة — يعمل في كل صفحات اللوحة */}
      <NewOrdersWatcher />
      {/* الشريط الجانبي (سطح المكتب) */}
      <aside className="no-print hidden w-60 shrink-0 border-e border-border bg-surface lg:flex lg:flex-col">
        <div className="border-b border-border px-6 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/v4-outline.svg"
            alt="Focus Point"
            width={76}
            height={36}
            className="h-9 w-auto"
          />
          <p className="mt-2 text-xs text-muted">{t("admin.chrome.label")}</p>
        </div>
        <AdminNav />
      </aside>

      {/* المحتوى الرئيسي */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* هيدر علوي (تابلت/موبايل): تنقل + شعار */}
        <header className="no-print flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
{/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/v4-outline.svg"
              alt="Focus Point"
              width={59}
              height={28}
              className="h-7 w-auto"
            />
            <span className="text-xs text-muted">{t("admin.chrome.label")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HospitalityQuickLogButton compact />
            <LogoutIconButton />
          </div>
        </header>

        {/* تنقل أفقي للتابلت */}
        <nav className="no-print flex gap-1 overflow-x-auto border-b border-border bg-surface px-3 py-2 lg:hidden">
          <AdminNavCompact />
        </nav>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}