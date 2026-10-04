"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/components/LanguageProvider";
import { formatDuration, usePolling } from "@/lib/admin-hooks";
import { seatLabel } from "@/lib/rooms";

// ============================================================
// لوحة تفاصيل الجلسة النشطة — تُفتح بالضغط على كرسي مشغول
// في خريطة القاعات. نفس نسق الداشبورد: بطاقة سطح + بادج +
// بطاقة بطل للعدّاد + صفوف تفاصيل + قائمة طلبات الخدمات.
// ============================================================

type Order = {
  id: string;
  status: string;
  service_name: string;
  created_at: string;
};

type Detail = {
  id: string;
  status: string;
  check_in: string;
  student_name: string;
  student_phone: string | null;
  spot_room: string;
  spot_group_label: string;
  spot_seat_number: number;
  orders: Order[];
};

const POLL_DETAIL_MS = 5000;

function roomName(room: string, t: (k: string) => string): string {
  if (room === "social") return t("admin.room.social");
  if (room === "silent") return t("admin.room.silent");
  if (room === "smoking") return t("admin.room.smoking");
  return room;
}

function statusBadge(status: string): string {
  if (status === "done") return "badge badge-done";
  if (status === "cancelled") return "badge badge-neutral";
  return "badge badge-pending";
}

export function SessionDetailPanel({
  sessionId,
  onClose,
  onEnded,
}: {
  sessionId: string;
  onClose: () => void;
  onEnded: (sessionId: string) => void;
}) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "الآن" المنقّحة با��خادم + نبضة كل ثانية (لا Date.now أثناء التصيير).
  const [now, setNow] = useState(0);
  const skewRef = useRef(0);
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState(false);
  const inFlight = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        // الجلسة انتهت في مكان آخر — نغلق اللوحة ونحدّث الخريطة.
        onEnded(sessionId);
        onClose();
        return;
      }
      const data = await res.json();
      if (res.ok && data.ok) {
        setDetail(data.session);
        skewRef.current = data.server_now - Date.now();
        setNow(Date.now() + skewRef.current);
        setError(null);
      } else {
        setError(data.error ?? t("admin.session.loadFail"));
      }
    } catch {
      setError(t("admin.err.network"));
    } finally {
      inFlight.current = false;
    }
  }, [sessionId, onEnded, onClose, t]);

  // تفاصيل حيّة: اقتراع كل 5 ثوانٍ + نبضة كل ثانية لإعادة حساب العدّاد.
  usePolling(load, POLL_DETAIL_MS);

  useEffect(() => {
    const beat = setInterval(
      () => setNow(Date.now() + skewRef.current),
      1000
    );
    return () => clearInterval(beat);
  }, []);

  // Escape للإغلاق + قفل تمرير الصفحة + تركيز زر الإغلاق.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function endSession() {
    setEnding(true);
    try {
      const res = await fetch("/api/admin/end-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (res.ok) {
        showToast(t("admin.sessions.endedT"), "success");
        onEnded(sessionId);
        onClose();
      } else {
        const data = await res.json().catch(() => null);
        showToast(data?.error ?? t("admin.sessions.endFail"), "error");
      }
    } catch {
      showToast(t("admin.sessions.endFail"), "error");
    } finally {
      setEnding(false);
    }
  }

  const elapsed = detail
    ? now - new Date(detail.check_in).getTime()
    : 0;

  return createPortal(
    <div className="session-panel-backdrop" onClick={onClose} role="presentation">
      <div
        className="session-panel"
        role="dialog"
        aria-modal="true"
        aria-label={detail ? detail.student_name : t("admin.session.title")}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="bottom-sheet-handle" aria-hidden="true" />

        <div className="session-panel-head">
          <div className="session-panel-head-text">
            <span className="badge badge-live">
              <span className="pulse-dot" />
              {t("admin.session.activeBadge")}
            </span>
            <h3 className="session-panel-name">
              {detail?.student_name ?? t("common.loading")}
            </h3>
            <p className="session-panel-sub">
              {detail
                ? seatLabel(detail.spot_group_label, detail.spot_seat_number)
                : ""}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="session-panel-close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {!detail && !error && (
          <div className="flex flex-col gap-3">
            <div className="skeleton-line h-24 w-full rounded-xl" />
            <div className="skeleton-line h-4 w-2/3 rounded-md" />
            <div className="skeleton-line h-4 w-1/2 rounded-md" />
          </div>
        )}

        {detail && (
          <>
            <div className="session-panel-timer">
              <div className="timer-hero">
                <span className="timer-label">{t("admin.session.elapsed")}</span>
                <span
                  key={Math.max(0, Math.floor(elapsed / 1000))}
                  className="timer-value"
                  dir="ltr"
                >
                  {formatDuration(elapsed)}
                </span>
              </div>
            </div>

            <dl className="session-facts">
              <div className="session-fact">
                <dt>{t("admin.session.checkIn")}</dt>
                <dd dir="ltr">{new Date(detail.check_in).toLocaleString()}</dd>
              </div>
              <div className="session-fact">
                <dt>{t("admin.col.room")}</dt>
                <dd>{roomName(detail.spot_room, t)}</dd>
              </div>
              <div className="session-fact">
                <dt>{t("admin.col.phone")}</dt>
                <dd dir="ltr">{detail.student_phone ?? "—"}</dd>
              </div>
            </dl>

            <div className="session-orders">
              <div className="session-orders-head">
                <h4 className="admin-section-title mb-0">
                  {t("admin.session.orders")}
                </h4>
                <span className="price-chip tabular-nums">
                  {detail.orders.length}
                </span>
              </div>

              {detail.orders.length === 0 ? (
                <p className="text-sm text-muted">
                  {t("admin.session.noOrders")}
                </p>
              ) : (
                <ul className="session-order-list">
                  {detail.orders.map((o) => (
                    <li key={o.id} className="session-order">
                      <span className="session-order-name">
                        {o.service_name}
                      </span>
                      <span className={statusBadge(o.status)}>
                        {t(`admin.order.${o.status}`)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="session-panel-actions">
              {confirming ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-danger px-4 py-2 text-sm"
                    onClick={endSession}
                    disabled={ending}
                  >
                    {ending ? t("common.loading") : t("admin.session.confirmEnd")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost px-4 py-2 text-sm"
                    onClick={() => setConfirming(false)}
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger px-4 py-2 text-sm"
                  onClick={() => setConfirming(true)}
                >
                  {t("admin.sessions.end")}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
