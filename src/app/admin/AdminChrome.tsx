"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminNav, LogoutIconButton } from "./AdminNav";
import { AdminMobileDrawer } from "./AdminMobileDrawer";
import { HospitalityQuickLogButton } from "./HospitalityQuickLog";
import { NewOrdersWatcher } from "./NewOrdersWatcher";
import { assetPath } from "@/lib/asset";
import { useI18n } from "@/components/LanguageProvider";

// هيكل لوحة التحكم (شريط جانبي لسطح المكتب + هيدر موبايل بقائمة 3 شحطات + درج جانبي).
export function AdminChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const cleanPath = pathname.replace(/^\/focus_point/, "").replace(/\/$/, "");
  const isLogin = cleanPath === "/admin/login";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      {/* مراقب الطلبات الجديدة — يعمل في كل صفحات اللوحة */}
      <NewOrdersWatcher />

      {/* درج التنقل للشاشات الصغيرة (الموبايل والتابلت) */}
      <AdminMobileDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* الشريط الجانبي (سطح المكتب) */}
      <aside className="no-print hidden w-60 shrink-0 border-e border-border bg-surface lg:flex lg:flex-col">
        <div className="border-b border-border px-6 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetPath("/brand/logo.png")}
            alt="Focus Point"
            width={76}
            height={48}
            className="h-10 w-auto object-contain"
          />
          <p className="mt-2 text-xs text-muted">{t("admin.chrome.label")}</p>
        </div>
        <AdminNav />
      </aside>

      {/* المحتوى الرئيسي */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* هيدر علوي (موبايل/تابلت): زر 3 شحطات + شعار + أدوات سريعة */}
        <header className="no-print flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2.5">
            {/* زر 3 شحطات (Hamburger Menu) لفتح قائمة التابات */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground shadow-sm hover:bg-primary-soft transition active:scale-95"
              aria-label="قائمة التابات"
              title="فتح قائمة الأقسام والتابات"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetPath("/brand/logo.png")}
                alt="Focus Point"
                width={59}
                height={38}
                className="h-8 w-auto object-contain"
              />
              <span className="text-xs font-bold text-muted">{t("admin.chrome.label")}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <HospitalityQuickLogButton compact />
            <LogoutIconButton />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}