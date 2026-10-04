"use client";

import { useI18n } from "@/components/LanguageProvider";

/** مبدّل اللغة التفاعلي — حبّة فاخرة بخيارين (عربي | English) مع
 *  "كبسولة" منزلقة (sliding thumb) تنتقل بنعومة نحو اللغة النشطة،
 *  بلا أي عناصر مشتّتة. يظهر في الشريط العلوي عبر BrandHeader. */
export function LanguageSwitch() {
  const { lang, setLang } = useI18n();

  return (
    <div
      className="lang-switch"
      role="group"
      aria-label="Language switch"
      data-lang={lang}
    >
      <span className="lang-switch-thumb" aria-hidden="true" />
      <button
        type="button"
        className={`lang-switch-cell ${lang === "ar" ? "lang-switch-cell-active" : ""}`}
        onClick={() => setLang("ar")}
        aria-pressed={lang === "ar"}
        aria-label="العربية"
      >
        <span className="lang-switch-name" dir="rtl">عربي</span>
      </button>
      <button
        type="button"
        className={`lang-switch-cell ${lang === "en" ? "lang-switch-cell-active" : ""}`}
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        aria-label="English"
      >
        <span className="lang-switch-name" dir="ltr">English</span>
      </button>
    </div>
  );
}