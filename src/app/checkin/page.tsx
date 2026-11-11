"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandHeader } from "@/components/BrandHeader";
import { ActiveSessionGuard } from "@/components/ActiveSessionGuard";
import { setStoredActiveSessionId, getStoredActiveSessionId } from "@/lib/active-session";
import { useI18n } from "@/components/LanguageProvider";

export default function CheckinPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = getStoredActiveSessionId();
      if (stored) setActiveSessionId(stored);
    } catch {}
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      setError(t("checkin.err.name"));
      return;
    }

    if (!/^\d{7,15}$/.test(phone.trim())) {
      setError(t("checkin.err.phone"));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error ?? t("checkin.err.generic"));
      } else if (data.redirect) {
        // الجلسة موجودة نشطة فعلاً (نفس الاسم) → نسجّل معرفها ونتوجه
        // لصفحتها مباشرة. replace حتى لا تتراكم صفحة التسجيل في السجل.
        setStoredActiveSessionId(data.session_id);
        router.replace(`/session/${data.session_id}`);
      } else {
        try {
          localStorage.setItem("demo_student_name", name.trim());
          localStorage.setItem("demo_student_phone", phone.trim());
          // مسح أي جلسة تجريبية سابقة لبدء عداد جديد
          localStorage.removeItem("demo_session_info");
        } catch {}
        router.replace(`/checkin/room?student_id=${data.student_id}`);
      }
    } catch {
      setError(t("checkin.err.network"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ActiveSessionGuard>
      <main className="page">
      <BrandHeader variant="large" />
      <div className="w-full max-w-md animate-fade-in-up">
        {activeSessionId && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-surface p-3.5 text-xs shadow-sm">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <span className="live-dot-green" aria-hidden="true" />
              توجد جلسة نشطة جارية
            </span>
            <Link
              href={`/session/${activeSessionId}`}
              className="font-semibold text-primary underline underline-offset-4 hover:opacity-80"
            >
              الذهاب إلى العداد ←
            </Link>
          </div>
        )}

        <div className="screen-header mb-8">
          <span className="badge badge-neutral">{t("checkin.step")}</span>
          <h1 className="screen-title">{t("checkin.title")}</h1>
          <p className="screen-sub">
            {t("checkin.sub")}
          </p>
        </div>

        <form className="card-lg" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name" className="label">
              {t("checkin.name.label")}
            </label>
            <input
              id="name"
              type="text"
              className="input"
              placeholder={t("checkin.name.placeholder")}
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
            <p className="mt-1.5 text-xs text-muted">{t("checkin.name.hint")}</p>
          </div>

          <div className="field">
            <label htmlFor="phone" className="label">
              {t("checkin.phone.label")}
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input"
              placeholder={t("checkin.phone.placeholder")}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              disabled={submitting}
            />
            <p className="mt-1.5 text-xs text-muted">{t("checkin.phone.hint")}</p>
          </div>

          <div className="field">
            <label htmlFor="nickname" className="label">
              {t("checkin.nickname.label")}
            </label>
            <input
              id="nickname"
              type="text"
              className="input"
              placeholder={t("checkin.nickname.label")}
              disabled={submitting}
            />
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn btn-primary mt-1 w-full" disabled={submitting}>
            {submitting ? t("checkin.submitting") : t("checkin.submit")}
            {!submitting && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ transform: "scaleX(-1)" }}
              >
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
            )}
          </button>
        </form>

        <div className="mt-5 border-t border-border/40 pt-4 text-center">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-muted transition hover:text-primary font-medium"
          >
            <span>لوحة الإدارة والمشرفين</span>
            <span dir="ltr">←</span>
          </Link>
        </div>
      </div>
      </main>
    </ActiveSessionGuard>
  );
}
