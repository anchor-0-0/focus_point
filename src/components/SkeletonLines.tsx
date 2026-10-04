// هيكل تحميل (Skeleton) بلون --color-beige بشفافية منخفضة مع نبضة خفيفة.
import { useI18n } from "@/components/LanguageProvider";

export function SkeletonLines({ rows = 3 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label={t("common.loading")}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton-line h-4 w-full rounded-md"
        />
      ))}
    </div>
  );
}