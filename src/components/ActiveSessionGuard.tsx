"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandHeader } from "@/components/BrandHeader";
import { useI18n } from "@/components/LanguageProvider";
import {
  getStoredActiveSessionId,
  clearStoredActiveSessionId,
} from "@/lib/active-session";

// ============================================================
// حارس الجلسة النشطة — يُركّب داخل صفحات التسجيل (/checkin و
// /checkin/room) قبل عرض أي فورم.
//
// المهمة: لا يمكن للطالب إنهاء جلسته عبر زر الرجوع أو إغلاق
// المتصفح؛ قامة الجلسة حصراً من الأدمن. فإذا كان هناك معرف جلسة
// مخزّن في localStorage وكانت الجلسة لا تزال نشطة في الخادم،
// نعيده فوراً لصفحة جلسته دون السماح له برؤية فورم جديد يوحى
// بخروجه من النظام. وإن كانت الجلسة انتهت أو اختفت، نمسح القيمة
// المعطوبة ونعرض صفحة التسجيل بشكل طبيعي.
//
// ملاحظة: نبدأ بـ checking=true دائماً (حتى لو لم يكن هناك معرف
// مخزّن) حتى يتطابق العرض الأولي أثناء الهيدرة، ثم ننتهي من
// الفحص في دورة لامتزامنة — لا توجد "ومضة" محسوسة لأن القراءة
// والقراءة من localStorage تكتمل قبل الرسم عادةً.
// ============================================================
export function ActiveSessionGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // في وضع العرض التجريبي (GitHub Pages أو DEMO_MODE): نسمح للزائر دائماً برؤية
    // شاشة تسجيل الدخول واختبار تعبئة البيانات دون أن نحتجزه في شاشة العداد القديمة.
    const isDemo =
      process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
      (typeof window !== "undefined" &&
        (window.location.hostname.includes("github.io") ||
          window.location.pathname.startsWith("/focus_point") ||
          window.localStorage.getItem("fp_demo_mode") === "true"));

    if (isDemo) {
      setChecking(false);
      return;
    }

    (async () => {
      const storedId = getStoredActiveSessionId();
      if (!storedId) return;

      try {
        const res = await fetch(`/api/session/${encodeURIComponent(storedId)}/status`, {
          cache: "no-store",
        });
        if (cancelled) return;

        if (res.status === 404) {
          // الجلسة غير موجودة → قيمة قديمة، نمسحها ونعرض التسجيل.
          clearStoredActiveSessionId();
          return;
        }

        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (!data || data.status === "ended") {
          // انتهت أو استجابة غريبة → لا نقفل الطالب، نمسح ونعرض الفورم.
          clearStoredActiveSessionId();
        } else if (data.status === "active") {
          // جلسته لا تزال حية → نعيده إليها فوراً
          router.replace(`/session/${storedId}`);
        }
      } catch {
        // خطأ شبكة/خادم مؤقت: نعرض الفورم بشكل طبيعي للسماح بالمتابعة.
      }
    })().finally(() => {
      if (!cancelled) setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <main className="page">
        <BrandHeader variant="large" />
        <div className="w-full max-w-md animate-fade-in-up text-center">
          <p className="text-sm text-muted">{t("guard.checking")}</p>
        </div>
      </main>
    );
  }

  return children;
}