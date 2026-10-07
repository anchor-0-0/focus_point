"use client";

import { useI18n } from "@/components/LanguageProvider";

export function InvoicePrintButton() {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="btn btn-primary w-full px-4 py-2"
      onClick={() => window.print()}
    >
      {t("ended.invoice.print")}
    </button>
  );
}