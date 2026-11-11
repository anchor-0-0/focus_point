"use client";

// ============================================================
// رأس الهوية — الشعار الرسمي لـ Focus Point أعلى صفحات الطالب.
// (V4 — حروف Vector) للنسخة المدمجة بارتفاع 28px، و(V1) للكبيرة
// بارتفاع 64px. بلا مفاتيح أو أشرطة إضافية.
// كل النسخ منقولة حرفياً عن ملف الـ SVG الأصلي.
// ============================================================
import { useI18n } from "@/components/LanguageProvider";
import { assetPath } from "@/lib/asset";

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
          src={assetPath("/brand/logo.png")}
          alt="Focus Point"
          className="brand-logo"
          width={large ? 120 : 68}
          height={large ? 80 : 45}
          style={{
            objectFit: "contain",
            width: large ? "120px" : "68px",
            height: "auto",
          }}
        />
        {!large && (
          <p className="brand-tagline">{t("brand.tagline")}</p>
        )}
      </header>
    </div>
  );
}
