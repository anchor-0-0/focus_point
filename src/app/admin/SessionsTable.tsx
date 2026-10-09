"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePolling, formatDuration } from "@/lib/admin-hooks";
import { POLL_STANDARD_MS } from "@/lib/admin-poll";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonLines } from "@/components/SkeletonLines";
import { EndSessionModal } from "@/components/EndSessionModal";
import { seatLabel } from "@/lib/rooms";
import { formatThousands } from "@/lib/money";
import { useI18n } from "@/components/LanguageProvider";

type SessionRow = {
  id: string;
  student_name: string;
  spot_room: string | null;
  spot_group_label: string | null;
  spot_seat_number: number | null;
  check_in: string;
  billable_hours: number;
  session_amount: number;
};

export function SessionsTable() {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  // أول جلب: حتى لا "تومض" رسالة "لا توجد جلسات" قبل تحميل أي بيانات.
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const inFlight = useRef(false);

  // لحظة الاقتراع الأخيرة — نستخدمها لحساب الوقت المنقضي حياً.
  // "الآن" تأتي من عدّاد داخلي (state) حتى لا نُنادي Date.now() أثناء الرسم.
  const [nowMs, setNowMs] = useState(0);

  // الجلسة المحددة للإنهاء — تُفتح نافذة المعاينة/الخصم بدل الإنهاء المباشر.
  const [endId, setEndId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/admin/sessions", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSessions(data.sessions);
        setNowMs(Date.now());
        setFirstLoadDone(true);
        setError(null);
      } else {
        setFirstLoadDone(true);
        setError(data.error ?? t("admin.sessions.loadFail"));
      }
    } catch {
      setFirstLoadDone(true);
      setError(t("admin.err.network"));
    } finally {
      inFlight.current = false;
    }
  }, [t]);

  usePolling(load, POLL_STANDARD_MS);

  // تحديث العدّاد كل ثانية بين دورات الـ polling.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (error) return <p className="text-sm text-danger">{error}</p>;

  if (sessions.length === 0) {
    if (!firstLoadDone) {
      return <SkeletonLines rows={4} />;
    }
    return <EmptyState title={t("admin.sessions.empty")} hint={t("admin.sessions.emptyHint")} />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface" style={{ boxShadow: "var(--shadow-card)" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t("admin.col.student")}</th>
            <th>{t("admin.col.room")}</th>
            <th>{t("admin.col.seat")}</th>
            <th>{t("admin.col.duration")}</th>
            <th className="text-end">{t("admin.col.billable")}</th>
            <th className="text-end">{t("admin.col.projectedAmount")}</th>
            <th className="text-end">{t("admin.col.action")}</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const elapsed = nowMs > 0 ? nowMs - new Date(s.check_in).getTime() : 0;
            return (
              <tr key={s.id}>
                <td className="font-medium text-foreground">{s.student_name}</td>
                <td>
                  {s.spot_room === "silent"
                    ? t("admin.room.silent")
                    : s.spot_room === "social"
                      ? t("admin.room.social")
                      : s.spot_room === "smoking"
                        ? t("admin.room.smoking")
                        : "—"}
                </td>
                <td>{seatLabel(s.spot_group_label, s.spot_seat_number)}</td>
                <td dir="ltr" className="tabular-nums">
                  {formatDuration(elapsed)}
                </td>
                <td className="text-end tabular-nums">
                  {s.billable_hours} <span className="text-muted">{t("common.hourShort")}</span>
                </td>
                <td className="text-end tabular-nums">
                  {formatThousands(s.session_amount)} <span className="text-muted">{t("admin.currency")}</span>
                </td>
                <td className="text-end">
                  <button
                    type="button"
                    className="btn btn-danger px-4 py-2 text-sm"
                    onClick={() => setEndId(s.id)}
                  >
                    {t("admin.sessions.end")}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {endId && (
        <EndSessionModal
          sessionId={endId}
          onClose={() => setEndId(null)}
          onEnded={() => load()}
        />
      )}
    </div>
  );
}