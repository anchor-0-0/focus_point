// ============================================================
// تنسيق موحّد للأموال في الواجهة (فواصل الآلاف).
// يُستعمل لكل عرض مبالغ: الفواتير، بطاقات الإيرادات، قوائم الخدمات.
// الأعداد الصحيحة تُعرض بلا كسور، والكسور حتى منزلتين.
// ملاحظة: يبقى إلحاق وحدة العملة (ل.س / SYP) عبر مفاتيح i18n
// المناسبة بحيث يتغيّر مع تبديل اللغة.
// ============================================================

export function formatThousands(n: number): string {
  const value = Number.isFinite(n) ? n : 0;
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString("en-US", {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}