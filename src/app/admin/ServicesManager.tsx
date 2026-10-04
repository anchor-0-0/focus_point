"use client";

import { useCallback, useState } from "react";
import { usePolling } from "@/lib/admin-hooks";
import { POLL_STANDARD_MS } from "@/lib/admin-poll";
import { useToast } from "@/components/Toast";
import { SkeletonLines } from "@/components/SkeletonLines";
import { useI18n } from "@/components/LanguageProvider";

type Service = {
  id: string;
  name: string;
  category: string | null;
  price: number;
};

type FormState = { name: string; category: string; price: string };

const emptyForm: FormState = { name: "", category: "", price: "" };

export function ServicesManager() {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/services", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setServices(data.services);
        setError(null);
      } else {
        setError(data.error ?? t("admin.services.loadFail"));
      }
    } catch {
      setError(t("admin.err.network"));
    }
  }, [t]);

  // تحميل أولي + تحديث دوري حتى تظهر تعديلات الخدمات فوراً
  usePolling(() => {
    load().catch(() => {});
  }, POLL_STANDARD_MS);

  function startEdit(service: Service) {
    setEditingId(service.id);
    setForm({
      name: service.name,
      category: service.category ?? "",
      price: String(service.price),
    });
    setError(null);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim(),
        price: form.price,
      };
      const res = editingId
        ? await fetch(`/api/admin/services/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/services", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? t("admin.services.saveFail"));
        showToast(data.error ?? t("admin.services.saveFail"), "error");
      } else {
        resetForm();
        await load();
        showToast(editingId ? t("admin.services.savedEdit") : t("admin.services.savedAdd"), "success");
      }
    } catch {
      setError(t("admin.err.network"));
      showToast(t("admin.err.network"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t("admin.services.confirmDelete"))) return;
    try {
      const res = await fetch(`/api/admin/services/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? t("admin.services.deleteFail"));
        showToast(data.error ?? t("admin.services.deleteFail"), "error");
      } else {
        await load();
        showToast(t("admin.services.deleted"), "success");
      }
    } catch {
      setError(t("admin.err.network"));
      showToast(t("admin.err.network"), "error");
    }
  }

  if (services === null) {
    return <SkeletonLines rows={4} />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* قائمة الخدمات */}
      <section>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface" style={{ boxShadow: "var(--shadow-card)" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("admin.col.service")}</th>
                <th>{t("admin.col.category")}</th>
                <th>{t("admin.col.price")}</th>
                <th className="text-end">{t("admin.col.action")}</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium text-foreground">{s.name}</td>
                  <td>{s.category ?? "—"}</td>
                  <td dir="ltr" className="tabular-nums">
                    {s.price.toFixed(2)} {t("admin.currency")}
                  </td>
                  <td className="text-end">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn btn-option px-4 py-2 text-sm"
                        onClick={() => startEdit(s)}
                      >
                        {t("admin.services.edit")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger px-4 py-2 text-sm"
                        onClick={() => remove(s.id)}
                      >
                        {t("admin.services.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {services.length === 0 && (
            <p className="p-4 text-sm text-muted">{t("admin.services.empty")}</p>
          )}
        </div>
      </section>

      {/* فورم إضافة/تعديل */}
      <section className="h-fit rounded-xl border border-border bg-surface p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <h2 className="admin-section-title mb-4">
          {editingId ? t("admin.services.editTitle") : t("admin.services.addTitle")}
        </h2>

        {error && <p className="error">{error}</p>}

        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="field">
            <label className="label" htmlFor="svc-name">{t("admin.services.serviceName")}</label>
            <input
              id="svc-name"
              type="text"
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="svc-cat">{t("admin.col.category")}</label>
            <input
              id="svc-cat"
              type="text"
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder={t("admin.services.catPlaceholder")}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="svc-price">{t("admin.services.priceField")}</label>
            <input
              id="svc-price"
              type="number"
              min={0}
              step="0.01"
              className="input"
              required
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
              {busy ? t("admin.services.save") : editingId ? t("admin.services.saveEdit") : t("admin.services.add")}
            </button>
            {editingId && (
              <button type="button" className="btn btn-option" onClick={resetForm}>
                {t("admin.services.cancel")}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}