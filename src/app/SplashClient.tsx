"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/LanguageProvider";

// ============================================================
// صفحة السبلاش — أول شاشة بعد مسح الباركود
// الشعار (v2-light) متمركز في المنتصف، تحته نبذة قصيرة، وثلاث
// نقاط تحميل هادئة بالأسفل. تنتقل تلقائياً لـ /checkin بعد
// SPLASH_MS، أو فوراً عند النقر/اللمس في أي مكان بالشاشة.
// تظهر في كل جلسة (لا تخزين لأي "شوهدت سابقاً" في التخزين).
// ============================================================

const SPLASH_MS = 2800;
const EXIT_MS = 400; // يطابق --transition-slow في وحدة الهوية.

export function SplashClient() {
  const router = useRouter();
  const { t } = useI18n();
  const rootRef = useRef<HTMLElement | null>(null);
  const navigatingRef = useRef(false);

  const go = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;

    // fade خارجي ناعم على السبلاش وحده أولاً، ثم الانتقال لـ /checkin.
    rootRef.current?.classList.add("splash-leaving");
    window.setTimeout(() => {
      router.replace("/checkin");
    }, EXIT_MS);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(go, SPLASH_MS);
    // إن انتهت المدة والتُقطت لمسة متأخرة، يحرسنا navigatingRef من التكرار.
    return () => window.clearTimeout(timer);
  }, [go]);

  return (
    <main
      ref={rootRef}
      className="splash-screen"
      role="button"
      tabIndex={0}
      aria-label={t("splash.aria")}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      }}
    >
      <div className="splash-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/v2-light.svg"
          alt="Focus Point"
          width={150}
          height={110}
          className="splash-logo splash-enter"
          style={{ animationDelay: "80ms" }}
        />

        <p className="splash-tagline splash-enter" style={{ animationDelay: "220ms" }}>
          {t("splash.tagline")}
        </p>
      </div>

      <div className="splash-footer">
        <span className="splash-dots splash-enter" aria-hidden="true">
          <span className="splash-dot" />
          <span className="splash-dot" />
          <span className="splash-dot" />
        </span>
      </div>
    </main>
  );
}