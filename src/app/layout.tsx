import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Cairo, Inter } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import { LanguageProvider } from "@/components/LanguageProvider";
import { getServerLang } from "@/lib/server-lang";
import { translate, type DictKey } from "@/lib/i18n";
import { DemoMockClient } from "@/components/DemoMockClient";
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
  const lang = await getServerLang();
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
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#402127",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // قراءة لغة الجلسة من الكوكي لضبط اتجاه الصفحة RTL/LTR عند تصيير
  // الخادم (فلا يومض الاتجاه ولا تختلط المسافات عند فتح الصفحة).
  const lang = await getServerLang();

  return (
    <html
      lang={lang}
      dir={lang === "en" ? "ltr" : "rtl"}
      className={`${cairo.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <LanguageProvider initialLang={lang}>
          <ToastProvider>
            <DemoMockClient />
            {children}
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}