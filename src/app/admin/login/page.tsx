"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandHeader } from "@/components/BrandHeader";
import { useI18n } from "@/components/LanguageProvider";

export default function AdminLoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!password) {
      setError(t("admin.login.errRequired"));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error ?? t("admin.login.errWrong"));
        setSubmitting(false);
        return;
      }

      router.replace("/admin");
    } catch {
      setError(t("admin.login.errNetwork"));
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      {/* مفتاح اللغة داخل الشريط العلوي (BrandHeader) — موضع موحّد
          مع صفحات الطالب، فلا يتكرر الزر أو يتوه. */}
      <BrandHeader variant="large" />
      <div className="card">
        <h1 className="card-title">{t("admin.login.title")}</h1>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="password" className="label">
              {t("admin.login.password")}
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? t("admin.login.submitting") : t("admin.login.submit")}
          </button>
        </form>

        <p className="mt-4 text-xs text-muted">
          {t("admin.login.footnote")}
        </p>
      </div>
    </main>
  );
}