"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { formatThousands } from "@/lib/money";
import { HospitalityQuickLogButton } from "./HospitalityQuickLog";

// ============================================================
// Ù‚Ø³Ù… Ø§Ù„Ø¶ÙŠØ§ÙØ© â€” ØªØ¨ÙˆÙŠØ¨Ø§Øª (Ø§Ù„ÙƒÙ„/Ø¶ÙŠÙˆÙ/Ø¥Ø¯Ø§Ø±Ø©) + Ø¥Ø­ØµØ§Ø¡ Ù„ÙƒÙ„ Ù†ÙˆØ¹ Ø«Ù…
// Ø§Ù„Ù…Ø¬Ù…ÙˆØ¹ + ØªÙØµÙŠÙ„ Ø§Ù„Ø£ØµÙ†Ø§Ù ÙˆØ§Ø³ØªÙ‡Ù„Ø§Ùƒ ÙƒÙ„ Ø´Ø®Øµ + Ø¬Ø¯ÙˆÙ„ Ø¨ÙÙ„ØªØ±Ø©
// (Ø§Ù„Ù†ÙˆØ¹/Ø§Ù„Ø´Ø®Øµ/Ø§Ù„ÙØªØ±Ø©) + Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø£Ø³Ù…Ø§Ø¡ Ø§Ù„Ù…Ø­ÙÙˆØ¸Ø©.
// ------------------------------------------------------------
// Ù„ÙˆÙ† Ø§Ù„Ù‚Ø³Ù… Ø¨Ù†Ù‘ÙŠ/Ø¨ÙŠØ¬ â€” Ø§Ù„Ø¶ÙŠØ§ÙØ© Ù„ÙŠØ³Øª Ù…Ø§Ù„Ø§Ù‹ ÙˆÙ„Ø§ ØªØ¯Ø®Ù„ Ø¨Ø§Ù„Ø¥ÙŠØ±Ø§Ø¯Ø§Øª.
// ============================================================

type HospLog = {
  id: string;
  created_at: string;
  recipient_type: "guest" | "management";
  recipient_label: string;
  recipient_id: string | null;
  guest_label: string | null;
  guests_count: number;
  quantity: number;
  unit_price: number;
  estimated_value: number;
  service_id: string;
  service_name: string;
  service_category: string | null;
  note: string | null;
};

type Bucket = {
  entries: number;
  people: number;
  quantity: number;
  kinds: number;
  value: number;
  by_service: { name: string; quantity: number; value: number }[];
};

type Tab = "all" | "guest" | "management";

function emptyBucket(): Bucket {
  return {
    entries: 0,
    people: 0,
    quantity: 0,
    kinds: 0,
    value: 0,
    by_service: [],
  };
}

function summarize(logs: HospLog[]): Bucket {
  const b = emptyBucket();
  const byService = new Map<string, { name: string; quantity: number; value: number }>();
  for (const l of logs) {
    b.entries += 1;
    b.people += l.guests_count;
    b.quantity += l.quantity;
    b.value = Math.round((b.value + l.estimated_value) * 100) / 100;
    const cur = byService.get(l.service_id);
    if (cur) {
      cur.quantity += l.quantity;
      cur.value = Math.round((cur.value + l.estimated_value) * 100) / 100;
    } else {
      byService.set(l.service_id, {
        name: l.service_name,
        quantity: l.quantity,
        value: l.estimated_value,
      });
    }
  }
  b.by_service = [...byService.values()].sort((x, y) => y.quantity - x.quantity);
  b.kinds = b.by_service.length;
  return b;
}

function localToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}/${day} ${hh}:${mm}`;
}

export function HospitalityManager() {
  const { t } = useI18n();

  const [tab, setTab] = useState<Tab>("all");
  const [from, setFrom] = useState(localToday);
  const [to, setTo] = useState(localToday);
  const [person, setPerson] = useState("");

  const [logs, setLogs] = useState<HospLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [namesOpen, setNamesOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (tab !== "all") params.set("type", tab);
      const res = await fetch(`/api/admin/hospitality?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        setError(t(json?.error ?? "admin.hospitality.loadFail"));
        return;
      }
      setLogs(json.logs);
      setError(null);
    } catch {
      setError(t("admin.hospitality.loadFail"));
    }
  }, [from, to, tab, t]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  // Ø§Ù„Ø£Ø´Ø®Ø§Øµ Ø§Ù„Ù…ØªØ§Ø­ÙˆÙ† Ù„Ù„ÙÙ„ØªØ±Ø© = Ù…Ù† Ø§Ù„Ø³Ø¬Ù„Ø§Øª Ø§Ù„Ù…Ø¹Ø±ÙˆØ¶Ø©.
  const peopleOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const l of logs ?? []) {
      const key = l.recipient_id ?? `label:${l.recipient_label}`;
      if (!seen.has(key)) seen.set(key, l.recipient_label);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], "ar"));
  }, [logs]);

  const shown = useMemo(() => {
    let list = logs ?? [];
    if (person) {
      list = list.filter(
        (l) => (l.recipient_id ?? `label:${l.recipient_label}`) === person
      );
    }
    return list;
  }, [logs, person]);

  const guestStats = useMemo(
    () => summarize(shown.filter((l) => l.recipient_type === "guest")),
    [shown]
  );
  const mgmtStats = useMemo(
    () => summarize(shown.filter((l) => l.recipient_type === "management")),
    [shown]
  );
  const totalStats = useMemo(() => summarize(shown), [shown]);

  // ØªÙØµÙŠÙ„ Ø§Ø³ØªÙ‡Ù„Ø§Ùƒ ÙƒÙ„ Ø´Ø®Øµ (Ø¥Ø¯Ø§Ø±Ø©): Ø§Ø³Ù… â† Ø£ØµÙ†Ø§ÙÙ‡ ÙˆÙ‚ÙŠÙ…ØªÙ‡.
  const perPerson = useMemo(() => {
    const groups = new Map<
      string,
      { name: string; entries: number; people: number; value: number; items: { name: string; quantity: number }[] }
    >();
    for (const l of shown.filter((x) => x.recipient_type === "management")) {
      const key = l.recipient_id ?? `label:${l.recipient_label}`;
      let g = groups.get(key);
      if (!g) {
        g = { name: l.recipient_label, entries: 0, people: 0, value: 0, items: [] };
        groups.set(key, g);
      }
      g.entries += 1;
      g.people += l.guests_count;
      g.value = Math.round((g.value + l.estimated_value) * 100) / 100;
      const item = g.items.find((i) => i.name === l.service_name);
      if (item) item.quantity += l.quantity;
      else g.items.push({ name: l.service_name, quantity: l.quantity });
    }
    return [...groups.values()].sort((a, b) => b.value - a.value);
  }, [shown]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      {/* Ø±Ø£Ø³ Ø§Ù„Ù‚Ø³Ù…: Ø²Ø± Ø§Ù„ØªØ³Ø±ÙŠØ¹ + Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø£Ø³Ù…Ø§Ø¡ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="hosp-dot" aria-hidden="true" />
          <span className="hosp-not-revenue">
            {t("admin.hospitality.notRevenue")}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HospitalityQuickLogButton onSaved={refresh} />
          <button
            type="button"
            className="btn btn-ghost whitespace-nowrap rounded-lg px-3 py-2 text-sm"
            onClick={() => setNamesOpen(true)}
          >
            {t("admin.hospitality.manageNames")}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {/* Ø§Ù„ÙÙ„Ø§ØªØ± */}
      <div className="hosp-filters">
        <div className="end-chip-row" role="group">
          {(["all", "guest", "management"] as Tab[]).map((k) => (
            <button
              key={k}
              type="button"
              className={`btn btn-option rounded-lg px-3 py-1.5 text-xs${tab === k ? " is-active" : ""}`}
              onClick={() => {
                setTab(k);
                setPerson("");
              }}
            >
              {k === "all"
                ? t("admin.hospitality.tabAll")
                : k === "guest"
                  ? t("admin.hospitality.tabGuests")
                  : t("admin.hospitality.tabManagement")}
            </button>
          ))}
        </div>

        <label className="hosp-filter-label">
          <span>{t("admin.report.from")}</span>
          <input
            type="date"
            className="input hosp-date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="hosp-filter-label">
          <span>{t("admin.report.to")}</span>
          <input
            type="date"
            className="input hosp-date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>

        <select
          className="input hosp-select"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          aria-label={t("admin.col.recipient")}
        >
          <option value="">{t("admin.hospitality.allNames")}</option>
          {peopleOptions.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Ø§Ù„Ø¥Ø­ØµØ§Ø¡: Ù„ÙƒÙ„ Ù†ÙˆØ¹ Ø«Ù… Ø§Ù„Ù…Ø¬Ù…ÙˆØ¹ */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title={t("admin.hospitality.guestStats")}
          tone="guest"
          b={guestStats}
        />
        <StatCard
          title={t("admin.hospitality.managementStats")}
          tone="management"
          b={mgmtStats}
        />
        <StatCard
          title={t("admin.hospitality.totalStats")}
          tone="total"
          b={totalStats}
        />
      </div>

      {/* ØªÙØµÙŠÙ„ Ø§Ù„Ø£ØµÙ†Ø§Ù + Ø§Ø³ØªÙ‡Ù„Ø§Ùƒ ÙƒÙ„ Ø´Ø®Øµ */}
      {(totalStats.by_service.length > 0 || perPerson.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {totalStats.by_service.length > 0 && (
            <section className="hosp-panel">
              <h2 className="admin-section-title mb-3">
                {t("admin.hospitality.byService")}
              </h2>
              <ul className="hosp-breakdown">
                {totalStats.by_service.map((s) => (
                  <li key={s.name}>
                    <span>{s.name}</span>
                    <span className="tabular-nums text-muted">
                      Ã— {s.quantity}
                    </span>
                    <span className="tabular-nums">
                      {formatThousands(s.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {perPerson.length > 0 && (
            <section className="hosp-panel">
              <h2 className="admin-section-title mb-3">
                {t("admin.hospitality.perPerson")}
              </h2>
              <ul className="hosp-person-list">
                {perPerson.map((g) => (
                  <li key={g.name}>
                    <div className="hosp-person-head">
                      <span className="font-semibold">{g.name}</span>
                      <span className="tabular-nums text-muted">
                        {g.people} {t("admin.hospitality.statPeople")} Â·{" "}
                        {formatThousands(g.value)}
                      </span>
                    </div>
                    <p className="hosp-person-items tabular-nums">
                      {g.items.map((i) => `${i.name} Ã—${i.quantity}`).join("ØŒ ")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Ø§Ù„Ø¬Ø¯ÙˆÙ„ */}
      <div className="hosp-panel">
        {shown.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium">
              {t("admin.hospitality.empty")}
            </p>
            <p className="mt-1 text-xs text-muted">
              {t("admin.hospitality.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t("admin.col.time")}</th>
                  <th>{t("admin.col.type")}</th>
                  <th>{t("admin.col.recipient")}</th>
                  <th>{t("admin.col.service")}</th>
                  <th>{t("admin.col.qty")}</th>
                  <th>{t("admin.hospitality.people")}</th>
                  <th>{t("admin.hospitality.estValueCol")}</th>
                  <th>{t("admin.col.details")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.id}>
                    <td className="tabular-nums text-muted">
                      {fmtTime(l.created_at)}
                    </td>
                    <td>
                      <span
                        className={`hosp-badge ${
                          l.recipient_type === "management"
                            ? "hosp-badge-mgmt"
                            : "hosp-badge-guest"
                        }`}
                      >
                        {l.recipient_type === "management"
                          ? t("admin.hospitality.management")
                          : t("admin.hospitality.guest")}
                      </span>
                    </td>
                    <td>{l.recipient_label}</td>
                    <td>{l.service_name}</td>
                    <td className="tabular-nums">{l.quantity}</td>
                    <td className="tabular-nums">{l.guests_count}</td>
                    <td className="tabular-nums">
                      {formatThousands(l.estimated_value)}
                    </td>
                    <td className="text-muted">{l.note ?? "â€”"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {namesOpen && (
        <HospitalityNamesModal
          onClose={() => setNamesOpen(false)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function StatCard({
  title,
  tone,
  b,
}: {
  title: string;
  tone: "guest" | "management" | "total";
  b: Bucket;
}) {
  const { t } = useI18n();
  return (
    <section className={`hosp-stat hosp-stat-${tone}`}>
      <h2 className="hosp-stat-title">{title}</h2>
      <p className="hosp-stat-value tabular-nums">
        {formatThousands(b.value)}
        <span className="hosp-stat-currency">{t("admin.currency")}</span>
      </p>
      <dl className="hosp-stat-grid">
        <div>
          <dt>{t("admin.hospitality.statEntries")}</dt>
          <dd className="tabular-nums">{b.entries}</dd>
        </div>
        <div>
          <dt>{t("admin.hospitality.statPeople")}</dt>
          <dd className="tabular-nums">{b.people}</dd>
        </div>
        <div>
          <dt>{t("admin.hospitality.statKinds")}</dt>
          <dd className="tabular-nums">{b.kinds}</dd>
        </div>
        <div>
          <dt>{t("admin.hospitality.statQty")}</dt>
          <dd className="tabular-nums">{b.quantity}</dd>
        </div>
      </dl>
    </section>
  );
}

// â”€â”€â”€ Ù†Ø§ÙØ°Ø© Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø£Ø³Ù…Ø§Ø¡ Ø§Ù„Ù…Ø­ÙÙˆØ¸Ø© â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type RecipientRow = {
  id: string;
  name: string;
  type: "guest" | "management";
  is_active: boolean;
  logs_count: number;
};

function HospitalityNamesModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [rows, setRows] = useState<RecipientRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/hospitality/recipients", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        setError(t(json?.error ?? "admin.hospitality.namesFail"));
        return;
      }
      setRows(json.recipients);
      setError(null);
    } catch {
      setError(t("admin.hospitality.namesFail"));
    }
  }, [t]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const patch = useCallback(
    async (id: string, data: { name?: string; is_active?: boolean }) => {
      if (busy) return;
      setBusy(true);
      try {
        const res = await fetch("/api/admin/hospitality/recipients", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...data }),
        });
        const json = await res.json().catch(() => null);
        if (!json?.ok) {
          setError(t(json?.error ?? "admin.hospitality.namesFail"));
          return;
        }
        setEditingId("");
        setEditName("");
        setError(null);
        showToast(t("admin.hospitality.updatedName"));
        await load();
        onChanged();
      } catch {
        setError(t("admin.hospitality.namesFail"));
      } finally {
        setBusy(false);
      }
    },
    [busy, load, onChanged, showToast, t]
  );

  const remove = useCallback(
    async (row: RecipientRow) => {
      if (busy) return;
      const ok = window.confirm(`"${row.name}" â€” ${t("admin.hospitality.deactivate")}?`);
      if (!ok) return;
      setBusy(true);
      try {
        const res = await fetch("/api/admin/hospitality/recipients", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: row.id }),
        });
        const json = await res.json().catch(() => null);
        if (!json?.ok) {
          setError(t(json?.error ?? "admin.hospitality.namesFail"));
          return;
        }
        showToast(
          json.deactivated
            ? t("admin.hospitality.deactivated")
            : t("admin.hospitality.deletedName")
        );
        await load();
        onChanged();
      } catch {
        setError(t("admin.hospitality.namesFail"));
      } finally {
        setBusy(false);
      }
    },
    [busy, load, onChanged, showToast, t]
  );

  return createPortal(
    <div
      className="session-panel-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="session-panel hosp-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("admin.hospitality.manageNames")}
      >
        <div className="session-panel-head">
          <div className="session-panel-head-text">
            <h3 className="session-panel-name">
              {t("admin.hospitality.manageNames")}
            </h3>
            <p className="session-panel-sub">
              {t("admin.hospitality.namesSub")}
            </p>
          </div>
          <button
            type="button"
            className="session-panel-close"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            Ã—
          </button>
        </div>

        <div className="hosp-body">
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          {rows === null ? (
            <p className="text-sm text-muted">{t("common.loading")}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted">
              {t("admin.hospitality.noNames")}
            </p>
          ) : (
            <ul className="hosp-names-list">
              {rows.map((r) => (
                <li key={r.id} className="hosp-name-row">
                  <span
                    className={`hosp-badge ${
                      r.type === "management"
                        ? "hosp-badge-mgmt"
                        : "hosp-badge-guest"
                    }`}
                  >
                    {r.type === "management"
                      ? t("admin.hospitality.management")
                      : t("admin.hospitality.guest")}
                  </span>

                  {editingId === r.id ? (
                    <input
                      className="input hosp-name-input"
                      value={editName}
                      maxLength={60}
                      autoFocus
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editName.trim()) {
                          e.preventDefault();
                          void patch(r.id, { name: editName.trim() });
                        }
                      }}
                    />
                  ) : (
                    <span className="hosp-name-text">
                      {r.name}
                      {!r.is_active && (
                        <span className="hosp-inactive">
                          {t("admin.hospitality.inactive")}
                        </span>
                      )}
                      <span className="text-muted">
                        Â· {r.logs_count} {t("admin.hospitality.statEntries")}
                      </span>
                    </span>
                  )}

                  <span className="hosp-name-actions">
                    {editingId === r.id ? (
                      <button
                        type="button"
                        className="btn btn-option rounded-lg px-2.5 py-1 text-xs"
                        disabled={busy || !editName.trim()}
                        onClick={() => void patch(r.id, { name: editName.trim() })}
                      >
                        {t("admin.hospitality.saveChanges")}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost rounded-lg px-2.5 py-1 text-xs"
                          onClick={() => {
                            setEditingId(r.id);
                            setEditName(r.name);
                          }}
                        >
                          {t("admin.hospitality.edit")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost rounded-lg px-2.5 py-1 text-xs"
                          disabled={busy}
                          onClick={() =>
                            void patch(r.id, { is_active: !r.is_active })
                          }
                        >
                          {r.is_active
                            ? t("admin.hospitality.deactivate")
                            : t("admin.hospitality.activate")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger rounded-lg px-2.5 py-1 text-xs"
                          disabled={busy}
                          onClick={() => void remove(r)}
                        >
                          Ã—
                        </button>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="session-panel-actions end-actions">
          <button
            type="button"
            className="btn btn-primary rounded-lg px-5 py-2 text-sm"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
