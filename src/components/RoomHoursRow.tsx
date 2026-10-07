"use client";

import { useI18n } from "@/components/LanguageProvider";

// صف «ساعات حسب القاعة» — شريط تقدم مع القيمة، يُستخدم في الداشبورد
// وواجهة التقارير ليَبقى شكل المكوّن موحّداً في كل الصفحات.
export function RoomHoursRow({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const { t } = useI18n();
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums font-medium text-foreground">
          {value} {t("common.hourShort")}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary-soft">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-[400ms]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}