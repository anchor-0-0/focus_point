"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { type DictKey } from "@/lib/i18n";
import { formatThousands } from "@/lib/money";
import { durationHM } from "@/lib/format";
import { seatLabel } from "@/lib/rooms";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonLines } from "@/components/SkeletonLines";

type HistoryRow = {
  session_id: string;
  student_name: string;
  room: string | null;
  group_label: string | null;
  seat_number: number | null;
  check_in: string;
  check_out: string;
  actual_duration_ms: number;
  billable_hours: number;
  session_amount: number;
  services_total: number;
  total: number;
};

type HistoryPayload = {
  ok: boolean;
  from: string;
  to: string;
  sessions: HistoryRow[];
};

const ROOM_KEY: Record<string, DictKey | undefined> = {
  social: "admin.room.social",
  silent: "admin.room.silent",
  smoking: "admin.room.smoking",
};

export function SessionsHistory() {
  const { t } = useI18n();
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Damascus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // حارس ترتيب: عند تغيير التاريخين بسرعة تتداخل طلبان — نتجاهل استجابة الأقدم.
  const loadSeq = useRef(0);

  const roomCol = (r: string | null): string => {
    const key = r ? ROOM_KEY[r] : undefined;
    return key ? t(key) : (r ?? "—");
  };

  const fmtMoney = (n: number): string =>
    `${formatThousands(n)} ${t("admin.currency")}`;

  const fmtDateTime = (iso: string): string => {
    const d = new Date(iso);
    const date = d.toLocaleDateString(t("meta.locale"));
    const time = d.toLocaleTimeString(t("meta.locale"), {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date} ${time}`;
  };

  // تحميل أولي لليوم الحالي عند فتح الصفحة (وإلا بقي الجدول هيكلاً حتى تغيير التاريخ).
  useEffect(() => {
    void load(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(f: string, tEnd: string) {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/sessions/history?from=${encodeURIComponent(f)}&to=${encodeURIComponent(tEnd)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (seq !== loadSeq.current) return;
      if (res.ok && json.ok) {
        setData(json as HistoryPayload);
      } else {
        setError(json.error ?? t("admin.sessions.historyFail"));
      }
    } catch {
      if (seq === loadSeq.current) setError(t("admin.err.network"));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
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

  const rows = data?.sessions ?? [];
  const totals = rows.reduce(
    (acc, r) => {
      acc.billable += r.billable_hours;
      acc.sessions += r.session_amount;
      acc.services += r.services_total;
      acc.total += r.total;
      return acc;
    },
    { billable: 0, sessions: 0, services: 0, total: 0 }
  );

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex flex-col gap-1">
        <h2 className="admin-section-title text-lg">{t("admin.sessions.historyTitle")}</h2>
        <p className="text-sm text-muted">{t("admin.sessions.historySub")}</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="field">
          <label className="label" htmlFor="history-from">
            {t("admin.report.from")}
          </label>
          <input
            id="history-from"
            type="date"
            className="input"
            value={from}
            onChange={(e) => handleFrom(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="history-to">
            {t("admin.report.to")}
          </label>
          <input
            id="history-to"
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

      {error && (
        <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p>
      )}

      {!data && !error ? (
        <SkeletonLines rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={t("admin.sessions.historyEmpty")}
          hint={t("admin.report.footnote")}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("admin.col.student")}</th>
                <th>{t("admin.col.roomShort")}</th>
                <th>{t("admin.col.seat")}</th>
                <th>{t("admin.col.checkInTime")}</th>
                <th>{t("admin.col.checkOutTime")}</th>
                <th>{t("admin.col.actualDuration")}</th>
                <th>{t("admin.col.billable")}</th>
                <th className="text-end">{t("admin.col.sessionAmount")}</th>
                <th className="text-end">{t("admin.col.servicesTotal")}</th>
                <th className="text-end">{t("admin.col.totalAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.session_id}>
                  <td className="font-medium text-foreground">{r.student_name}</td>
                  <td>{roomCol(r.room)}</td>
                  <td className="text-muted">{seatLabel(r.group_label, r.seat_number)}</td>
                  <td className="tabular-nums" dir="ltr">
                    {fmtDateTime(r.check_in)}
                  </td>
                  <td className="tabular-nums" dir="ltr">
                    {fmtDateTime(r.check_out)}
                  </td>
                  <td className="tabular-nums">
                    {durationHM(
                      r.actual_duration_ms,
                      t("common.hourShort"),
                      t("common.minuteShort")
                    )}
                  </td>
                  <td className="tabular-nums">
                    {r.billable_hours} <span className="text-muted">{t("common.hourShort")}</span>
                  </td>
                  <td className="text-end tabular-nums">{fmtMoney(r.session_amount)}</td>
                  <td className="text-end tabular-nums">{fmtMoney(r.services_total)}</td>
                  <td className="text-end tabular-nums font-semibold text-foreground">
                    {fmtMoney(r.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td
                  colSpan={6}
                  className="border-t-2 border-primary py-3 font-bold text-primary"
                >
                  {t("admin.col.grandTotal")}
                </td>
                <td className="border-t-2 border-primary py-3 text-end tabular-nums font-bold text-foreground">
                  {totals.billable} <span className="font-medium text-muted">{t("common.hourShort")}</span>
                </td>
                <td className="border-t-2 border-primary py-3 text-end tabular-nums font-bold text-foreground">
                  {fmtMoney(totals.sessions)}
                </td>
                <td className="border-t-2 border-primary py-3 text-end tabular-nums font-bold text-foreground">
                  {fmtMoney(totals.services)}
                </td>
                <td className="border-t-2 border-primary py-3 text-end tabular-nums font-bold text-primary">
                  {fmtMoney(totals.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}