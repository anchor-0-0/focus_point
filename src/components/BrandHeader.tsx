"use client";

// ============================================================
// رأس الهوية — الشعار الرسمي لـ Focus Point أعلى صفحات الطالب.
// (V4 — حروف Vector) للنسخة المدمجة بارتفاع 28px، و(V1) للكبيرة
// بارتفاع 64px. بلا مفاتيح أو أشرطة إضافية.
// كل النسخ منقولة حرفياً عن ملف الـ SVG الأصلي.
// ============================================================
import { useI18n } from "@/components/LanguageProvider";

type BrandHeaderProps = {
  readonly variant?: "compact" | "large";
};

export function BrandHeader({ variant = "compact" }: BrandHeaderProps) {
  const large = variant === "large";
  const { t } = useI18n();
  return (
    <div className="brand-wrap">
      <header
        className={`brand-header ${large ? "brand-header-large" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={large ? "/brand/v1-dark.svg" : "/brand/v4-outline.svg"}
          alt="Focus Point"
          className="brand-logo"
          width={large ? 95 : 59}
          height={large ? 64 : 28}
        />
        {!large && (
          <p className="brand-tagline">{t("brand.tagline")}</p>
        )}
      </header>
    </div>
  );
}
