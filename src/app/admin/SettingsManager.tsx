"use client";

import { useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { normalizeDigits, parsePositiveInt } from "@/lib/number-parse";

export function SettingsManager({ initialRate }: { initialRate: number }) {
  const { t } = useI18n();
  // القيمة معروضة بفواصل آلاف (en-US) للقراءة فقط؛ تُنظَّف قبل الحفظ.
  const [rate, setRate] = useState(initialRate.toLocaleString("en-US"));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // نقبل الأرقام الإنجليزية/العربية والفواصل، ونتحقق يدوياً (لا تحقق
    // متصفّح يمنع الإرسال). لا نُقرّب ولا نغيّر القيمة.
    const value = parsePositiveInt(rate);
    if (value === null) {
      setError(t("admin.settings.invalid"));
      setStatus("error");
      return;
    }

    setSaving(true);
    setStatus("idle");
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hourly_rate_syp: value }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && data.error) || t("admin.settings.invalid"));
        setStatus("error");
        return;
      }
      // نعرض القيمة المخزنة فعلاً (القادمة من الخادم) مع فواصل الآلاف.
      setRate(Number(data.settings.hourly_rate_syp).toLocaleString("en-US"));
      setStatus("saved");
    } catch {
      setError(t("admin.err.network"));
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="h-fit max-w-md rounded-xl border border-border bg-surface p-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <h2 className="admin-section-title mb-4">{t("admin.settings.hourlyRateField")}</h2>

      {status === "saved" && <p className="mb-3 text-sm font-medium text-success">{t("admin.settings.saved")}</p>}
      {status === "error" && error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="field">
          <label className="label" htmlFor="set-rate">
            {t("admin.settings.hourlyRateField")}
          </label>
          {/* نوع نصي + inputMode رقمي: لا أسهم/عجلة تُغيّر القيمة (الخطأ السابق
              كان min=1 + step=500 فيحصر القيم على 1+500k مثل 7001 لا 7000). */}
          <input
            id="set-rate"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            dir="ltr"
            className="input"
            value={rate}
            onChange={(e) => {
              setRate(normalizeDigits(e.target.value));
              setStatus("idle");
              setError(null);
            }}
            disabled={saving}
          />
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {t("admin.settings.hourlyRateHint")}
          </p>
        </div>

        <button type="submit" className="btn btn-primary px-4 py-2" disabled={saving}>
          {saving ? t("admin.settings.saving") : t("admin.settings.save")}
        </button>
      </form>
    </section>
  );
}