import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Cairo, Inter } from "next/font/google";
import { cookies } from "next/headers";
import { ToastProvider } from "@/components/Toast";
import { LanguageProvider } from "@/components/LanguageProvider";
import { DEFAULT_LANG, LANG_COOKIE, translate, langFromValue, type Lang, type DictKey } from "@/lib/i18n";
import "./globals.css";

// Cairo للنصوص العربية، وInter للأرقام/الإنجليزية/العناصر الميكانيكية.
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["latin", "arabic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  let lang: Lang = DEFAULT_LANG;
  try {
    const store = await cookies();
    lang = langFromValue(store.get(LANG_COOKIE)?.value);
  } catch {
    // بيئة دون كوكيز (أثناء البناء) — نبقى على العربية الافتراضية.
  }
  const t = (k: DictKey) => translate(k, lang);
  return {
    title: {
      default: "Focus Point",
      template: "%s | Focus Point",
    },
    description: t("meta.description"),
  };
}

// لون شريط المتصفح على الموبايل بنفس العائلة اللونية للسبلاش —
// يمنع وميضاً أبيض/رمادياً قبل رسم أول محتوى غامق.
export const viewport: Viewport = {
  themeColor: "#402127",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // قراءة لغة الجلسة من الكوكي لضبط اتجاه الصفحة RTL/LTR عند تصيير
  // الخادم (فلا يومض الاتجاه ولا تختلط المسافات عند فتح الصفحة).
  let lang: Lang = DEFAULT_LANG;
  try {
    const store = await cookies();
    const raw = store.get(LANG_COOKIE)?.value;
    if (raw === "en") lang = "en";
  } catch {
    // بيئة دون كوكيز (أثناء البناء) — نبقى على العربية الافتراضية.
  }

  return (
    <html
      lang={lang}
      dir={lang === "en" ? "ltr" : "rtl"}
      className={`${cairo.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <LanguageProvider initialLang={lang}>
          <ToastProvider>{children}</ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}