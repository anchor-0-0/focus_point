"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function ViewSwitchButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // فحص ما إذا كان المستخدم حالياً داخل واجهات لوحة التحكم أو واجهات الطالب
  const cleanPath = pathname?.replace(/^\/focus_point/, "").replace(/\/$/, "") || "/";
  const isAdmin = cleanPath.startsWith("/admin");

  const targetPath = isAdmin ? "/checkin" : "/admin";
  const label = isAdmin ? "واجهة الطالب" : "لوحة الإدارة";
  const icon = isAdmin ? (
    // أيقونة الطالب / الجلسة
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ) : (
    // أيقونة لوحة الإدارة / الداشبورد
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );

  return (
    <aside
      className="fixed bottom-4 start-4 z-50 no-print animate-fade-in"
      role="region"
      aria-label="التبديل بين واجهات النظام"
    >
      <button
        type="button"
        onClick={() => router.push(targetPath)}
        className="group flex items-center gap-2.5 rounded-full px-4 py-2.5 text-xs font-semibold text-white shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          backgroundColor: "#402128",
          border: "1px solid rgba(153, 127, 104, 0.45)",
          boxShadow: "0 8px 24px rgba(64, 33, 40, 0.35), 0 2px 6px rgba(0,0,0,0.2)",
        }}
        title={`الانتقال إلى ${label}`}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-tan transition group-hover:bg-white/20">
          {icon}
        </span>
        <span className="tracking-wide">{label}</span>
        <span className="text-[10px] text-tan/80 group-hover:text-white transition">
          ⇄
        </span>
      </button>
    </aside>
  );
}
