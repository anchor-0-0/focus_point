import type { Metadata } from "next";
import { SplashClient } from "./SplashClient";

export const metadata: Metadata = {
  title: "Focus Point",
};

// ============================================================
// الجذر "/" هو صفحة السبلاش.
// سبب الاختيار: باركود القاعة يشير غالباً إلى نطاق الموقع مباشرةً
// (الجذر)، فجعل الجذر نفسه هو السبلاش يضمن ظهوره في كل جلسة
// بغضّ النظر عن أصل الرابط — ثم ينتقل تلقائياً إلى /checkin.
// ============================================================
export default function Home() {
  return <SplashClient />;
}