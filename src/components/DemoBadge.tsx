"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function DemoBadge() {
  const isDemo =
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    (typeof window !== "undefined" &&
      (window.location.hostname.includes("github.io") ||
        window.location.pathname.startsWith("/focus_point")));

  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();

  if (!isDemo) return null;

  const isAdmin = pathname.startsWith("/admin");

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={() => setDismissed(false)}
        className="fixed bottom-3 left-3 z-50 flex h-7 w-7 items-center justify-center rounded-full bg-primary/90 text-[11px] text-accent shadow-md backdrop-blur transition hover:scale-110"
        title="إظهار تنويه النسخة التجريبية"
        aria-label="إظهار تنويه النسخة التجريبية"
      >
        ✦
      </button>
    );
  }

  return (
    <aside
      className="fixed bottom-3 left-3 z-50 flex items-center gap-2 rounded-full border border-border/80 bg-surface/95 px-3 py-1 text-xs text-foreground shadow-lg backdrop-blur-md transition-all sm:text-xs"
      role="region"
      aria-label="تنويه النسخة التجريبية"
      style={{
        boxShadow: "0 4px 16px rgba(64, 33, 39, 0.12)",
      }}
    >
      <div className="flex items-center gap-1.5 font-medium">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] text-muted">نسخة عرض تجريبية</span>
      </div>

      <span className="h-3 w-px bg-border" />

      <Link
        href={isAdmin ? "/session/demo" : "/admin"}
        className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-white transition hover:bg-primary-dark"
      >
        {isAdmin ? "🎓 واجهة الطالب" : "👑 لوحة الإدارة"}
      </Link>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-[11px] text-muted hover:text-foreground px-0.5"
        title="إخفاء"
        aria-label="إخفاء التنويه"
      >
        ✕
      </button>
    </aside>
  );
}
