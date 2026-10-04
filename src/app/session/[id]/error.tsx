"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/LanguageProvider";

// حد خطأ لمسار الجلسة: عند تعطّل الاتصال بقاعدة البيانات أو أي خطأ
// غير متوقع أثناء تحميل الجلسة، تُعرض رسالة واضحة بدل صفحة الخطأ
// الافتراضية أو صفحة "غير موجودة" المضلِّلة.
export default function SessionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    // سجّل السبب الجذري في وحدة تحكم الخادم للتشخيص.
    console.error("[session route error]", error);
  }, [error]);

  return (
    <main className="page">
      <div className="card text-center">
        <h1 className="card-title">{t("session.err.title")}</h1>
        <p className="mb-4 text-muted">
          {t("session.err.body")}
        </p>
        <button type="button" className="btn btn-primary w-full" onClick={reset}>
          {t("session.err.retry")}
        </button>
      </div>
    </main>
  );
}