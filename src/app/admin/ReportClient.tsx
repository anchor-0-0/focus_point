"use client";

import { useState } from "react";
import { SkeletonLines } from "@/components/SkeletonLines";
import { useI18n } from "@/components/LanguageProvider";
import type { ReportData } from "@/lib/report";

const STATUS_CLASS: Record<string, string> = {
  pending: "badge badge-pending",
  done: "badge badge-done",
  cancelled: "badge badge-neutral",
};

export function ReportClient({ initial }: { initial: ReportData }) {
  const { t, tw } = useI18n();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<ReportData | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const statusLabel = (status: string): string =>
    status === "pending"
      ? t("admin.status.pending")
      : status === "done"
        ? t("admin.status.done")
        : status === "cancelled"
          ? t("admin.status.cancelled")
          : status;

  const fmtMoney = (n: number): string =>
    `${n.toLocaleString("en", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${t("admin.currency")}`;

  const fmtTime = (iso: string): string =>
    new Date(iso).toLocaleTimeString(t("meta.locale"), {
      hour: "2-digit",
      minute: "2-digit",
    });

  const placeText = (group: string | null, seat: number | null): string => {
    const placeKey =
      group === "social_table"
        ? "admin.report.place.social_table"
        : group === "silent_writing"
          ? "admin.report.place.silent_writing"
          : group === "silent_bar"
            ? "admin.report.place.silent_bar"
            : group === "smoking_bar"
              ? "admin.report.place.smoking_bar"
              : undefined;
    const g = placeKey ? t(placeKey) : (group ?? "");
    return [
      g,
      typeof seat === "number" ? tw("admin.report.seat", { n: seat }) : "",
    ]
      .filter(Boolean)
      .join(" • ");
  };

  async function load(f: string, tEnd: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/report?from=${encodeURIComponent(f)}&to=${encodeURIComponent(tEnd)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (res.ok && json.ok) {
        setData(json as ReportData);
      } else {
        setError(json.error ?? t("admin.report.loadFail"));
      }
    } catch {
      setError(t("admin.err.network"));
    } finally {
      setLoading(false);
    }
  }

  function handleFrom(v: string) {
    setFrom(v);
    void load(v, to);
  }

  function handleTo(v: string) {
    setTo(v);
    void load(from, v);
  }

  const downloadUrl = `/api/admin/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=xlsx`;

  return (
    <div className="flex flex-col gap-5">
      {/* شريط الاختيار */}
      <section
        className="rounded-xl border border-border bg-surface p-5"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="field">
              <label className="label" htmlFor="report-from">
                {t("admin.report.from")}
              </label>
              <input
                id="report-from"
                type="date"
                className="input"
                value={from}
                onChange={(e) => handleFrom(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="report-to">
                {t("admin.report.to")}
              </label>
              <input
                id="report-to"
                type="date"
                className="input"
                value={to}
                onChange={(e) => handleTo(e.target.value)}
              />
            </div>
            <span className="text-sm text-muted">
              {loading ? t("admin.report.updating") : t("admin.report.autoNote")}
            </span>
          </div>

          <a
            className="btn btn-primary"
            href={downloadUrl}
            download
            aria-disabled={loading}
          >
            {t("admin.report.download")}
          </a>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {t("admin.report.footnote")}
        </p>
        {error && (
          <p className="mt-3 text-sm font-medium text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </section>

      {data ? (
        <>
          {/* بطاقات الملخص */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label={t("admin.report.studentsCard")}
              value={data.summary.students_count}
              sub={tw("admin.report.sessionsUnit", { n: data.summary.sessions_count })}
            />
            <SummaryCard
              label={t("admin.report.ordersCard")}
              value={data.summary.orders_count}
              sub={tw("admin.report.ordersBreakdown", {
                n: data.summary.done_count,
                p: data.summary.pending_count,
                c: data.summary.cancelled_count,
              })}
            />
            <SummaryCard
              label={t("admin.report.revenueCard")}
              value={fmtMoney(data.summary.done_revenue)}
              sub={tw("admin.report.revenueSub", { n: data.summary.done_count })}
            />
            <SummaryCard
              label={t("admin.report.servicesCard")}
              value={data.services.length}
              sub={t("admin.report.servicesSub")}
              hero
            />
          </div>

          {/* ملخص الخدمات */}
          <section
            className="rounded-xl border border-border bg-surface p-5"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <h2 className="admin-section-title text-lg">{t("admin.report.servicesTitle")}</h2>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t("admin.col.service")}</th>
                    <th>{t("admin.col.orders")}</th>
                    <th>{t("admin.col.doneCount")}</th>
                    <th>{t("admin.col.revenue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.services.map((sv) => (
                    <tr key={sv.name}>
                      <td>{sv.name}</td>
                      <td>{sv.count}</td>
                      <td>{sv.done_count}</td>
                      <td className="tabular-nums">{sv.done_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* سجل الخدمات لكل طالب */}
          <section className="flex flex-col gap-5">
            <h2 className="admin-section-title text-lg">
              {t("admin.report.studentLog")}
            </h2>
            {data.students.length === 0 ? (
              <p className="text-sm text-muted">
                {t("admin.report.noData")}
              </p>
            ) : (
              data.students.map((st) => {
                const studentOrders = data.orders.filter(
                  (o) => o.student_id === st.student_id
                );
                return (
                  <article
                    key={st.student_id}
                    className="rounded-xl border border-border bg-surface p-5"
                    style={{ boxShadow: "var(--shadow-card)" }}
                  >
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {st.name}
                        </h3>
                        <p className="text-sm text-muted">
                          {st.phone
                            ? tw("admin.report.phone", { phone: st.phone })
                            : t("admin.report.noPhone")}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="badge badge-neutral">
                          {tw("admin.report.sessionsUnit", { n: st.sessions_count })}
                        </span>
                        <span className="badge badge-neutral">
                          {tw("admin.report.ordersUnit", { n: st.orders_count })}
                        </span>
                        {st.done_amount > 0 && (
                          <span className="badge badge-done">
                            {fmtMoney(st.done_amount)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>{t("admin.col.time")}</th>
                            <th>{t("admin.col.place")}</th>
                            <th>{t("admin.col.service")}</th>
                            <th>{t("admin.col.details")}</th>
                            <th>{t("admin.col.price")}</th>
                            <th>{t("admin.col.status")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentOrders.map((o) => (
                            <tr key={o.order_id}>
                              <td className="tabular-nums">
                                {fmtTime(o.created_at)}
                              </td>
                              <td>
                                {placeText(o.group_label, o.seat_number)}
                              </td>
                              <td>{o.service_name}</td>
                              <td
                                className="max-w-md truncate"
                                title={o.details_label}
                              >
                                {o.details_label || "—"}
                              </td>
                              <td className="tabular-nums">
                                {o.price.toFixed(2)}
                              </td>
                              <td>
                                <span
                                  className={
                                    STATUS_CLASS[o.status] ??
                                    "badge badge-neutral"
                                  }
                                >
                                  {statusLabel(o.status)}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {studentOrders.length === 0 && (
                            <tr>
                              <td colSpan={6} className="text-muted">
                                {t("admin.report.noOrders")}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </>
      ) : error ? (
        <p className="text-sm font-medium text-[var(--color-danger)]">
          {error}
        </p>
      ) : (
        <SkeletonLines rows={4} />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  hero = false,
}: {
  label: string;
  value: number | string;
  sub?: string;
  hero?: boolean;
}) {
  if (hero) {
    return (
      <section className="stat-card-hero">
        <h2 className="stat-label">{label}</h2>
        <p className="stat-value tabular-nums">{value}</p>
        {sub && <p className="stat-sub">{sub}</p>}
      </section>
    );
  }
  return (
    <section className="stat-card flex flex-col justify-between gap-4">
      <div>
        <h2 className="stat-label">{label}</h2>
        <p className="stat-value tabular-nums">
          {value}
        </p>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
    </section>
  );
}