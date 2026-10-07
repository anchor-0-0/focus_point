"use client";

import { useState } from "react";
import { useI18n } from "@/components/LanguageProvider";

export function SettingsManager({ initialRate }: { initialRate: number }) {
  const { t } = useI18n();
  const [rate, setRate] = useState(String(initialRate));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Math.floor(Number(rate));
    if (!Number.isFinite(value) || value <= 0) {
      setStatus("error");
      return;
    }

    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hourly_rate_syp: value }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = await res.json();
      setRate(String(data.settings.hourly_rate_syp));
      setStatus("saved");
    } catch {
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
      {status === "error" && <p className="error">{t("admin.settings.invalid")}</p>}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="field">
          <label className="label" htmlFor="set-rate">
            {t("admin.settings.hourlyRateField")}
          </label>
          <input
            id="set-rate"
            type="number"
            inputMode="numeric"
            min={1}
            step={500}
            className="input"
            dir="ltr"
            required
            value={rate}
            onChange={(e) => {
              setRate(e.target.value);
              setStatus("idle");
            }}
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