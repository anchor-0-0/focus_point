"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { formatDuration, usePolling } from "@/lib/admin-hooks";
import { seatLabel } from "@/lib/rooms";
import { formatThousands } from "@/lib/money";
import {
  computeDiscount,
  type DiscountBases,
  type DiscountErrorCode,
  type DiscountScope,
  type DiscountType,
} from "@/lib/discount";

// ============================================================
// نافذة إنهاء الجلسة — معاينة الفاتورة + خصم اختياري.
// ------------------------------------------------------------
// - تجلب معاينة الفاتورة من /api/admin/sessions/[id] (الأرقام المرجعية).
// - إعادة الحساب اللحظي هنا بنفس منطق السيرفر المشترك (lib/discount)؛
//   والسيرفر يعيد الحساب مرة أخيرة ويرفض أي قيمة غير صالحة (400).
// - زر التأكيد أساسي، والإلغاء ثانوي، مع منع الضغط المزدوج.
// ============================================================

type Order = {
  id: string;
  status: string;
  service_name: string;
  units: number;
  total: number;
};

type Preview = {
  hourly_rate: number;
  billable_hours: number;
  hours_amount: number;
  orders_amount: number;
  gross_total: number;
};

type Detail = {
  id: string;
  status: string;
  check_in: string;
  student_name: string;
  spot_room: string;
  spot_group_label: string;
  spot_seat_number: number;
  orders: Order[];
  preview: Preview;
};

const SCOPE_OPTIONS: DiscountScope[] = ["total", "hours", "orders"];
const TYPE_OPTIONS: DiscountType[] = ["percent", "fixed", "free_hours"];

const ERR_KEYS: Record<DiscountErrorCode, string> = {
  invalid_scope: "admin.end.err.invalid_scope",
  invalid_type: "admin.end.err.invalid_type",
  invalid_value: "admin.end.err.invalid_value",
  negative: "admin.end.err.negative",
  percent_range: "admin.end.err.percent_range",
  free_hours_scope: "admin.end.err.free_hours_scope",
  exceeds_base: "admin.end.err.exceeds_base",
};

export function EndSessionModal({
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
  const [loadError, setLoadError] = useState<string | null>(null);

  const [scope, setScope] = useState<DiscountScope>("total");
  const [type, setType] = useState<DiscountType>("percent");
  const [valueStr, setValueStr] = useState("");
  const [note, setNote] = useState("");

  const [ending, setEnding] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // نبضة كل ثانية لعرض المدة الفعلية حيّة داخل المعاينة
  // (القيمة الأولية من مُهيّئ state — المكوّن لا يُصيَّر على الخادم).
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data.ok) {
        if (data.session.status !== "active") {
          // انتهت في مكان آخر — أغلق وأبلغ الجهة الأب لتحديث القوائم.
          onEnded(sessionId);
          onClose();
          return;
        }
        setDetail(data.session);
        setLoadError(null);
      } else {
        setLoadError(data?.error ?? t("admin.session.loadFail"));
      }
    } catch {
      setLoadError(t("admin.err.network"));
    }
  }, [sessionId, onEnded, onClose, t]);

  // تحميل فوري + تحديث دوري خفيف للمعاينة (الحقول المكتوبة state مستقلة
  // فلا تتأثر بتحديث المعاينة).
  usePolling(load, 30000);

  // قفل تمرير الصفحة + تركيز زر الإغلاق + Escape (يوقف انتشاره حتى لا
  // تُغلق لوحة الجلسة الأب مع النافذة).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onBackdropKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };

  // ── إعادة الحساب اللحظي (نفس قواعد lib/discount) ─────────
  const bases: DiscountBases | null = detail
    ? {
        billableHours: detail.preview.billable_hours,
        hourlyRate: detail.preview.hourly_rate,
        hoursAmount: detail.preview.hours_amount,
        ordersAmount: detail.preview.orders_amount,
      }
    : null;

  const valueNum = valueStr.trim() === "" ? null : Number(valueStr);
  const hasValue = valueNum !== null && Number.isFinite(valueNum) && valueNum > 0;

  let localErrorKey: string | null = null;
  let liveAmount = 0;
  let liveFinal = detail ? detail.preview.gross_total : 0;
  if (hasValue && bases) {
    const v = computeDiscount(
      { scope, type, value: valueNum as number, note },
      bases
    );
    if (v.ok) {
      liveAmount = v.discount.amount;
      liveFinal = v.discount.finalAmount;
    } else {
      localErrorKey = ERR_KEYS[v.code];
    }
  }

  function pickScope(next: DiscountScope) {
    setScope(next);
    if (next !== "hours" && type === "free_hours") setType("percent");
  }
  function pickType(next: DiscountType) {
    setType(next);
    if (next === "free_hours") setScope("hours");
  }

  async function confirmEnd() {
    if (inFlight.current) return;
    inFlight.current = true;
    setEnding(true);
    setServerError(null);
    try {
      const body: Record<string, unknown> = { session_id: sessionId };
      if (hasValue && !localErrorKey) {
        body.discount = { scope, type, value: valueNum, note: note.trim() || null };
      }
      const res = await fetch("/api/admin/end-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast(t("admin.sessions.endedT"), "success");
        onEnded(sessionId);
        onClose();
        return;
      }
      const data = await res.json().catch(() => null);
      const code = data?.code as DiscountErrorCode | undefined;
      setServerError(
        code && ERR_KEYS[code]
          ? t(ERR_KEYS[code])
          : (data?.error ?? t("admin.sessions.endFail"))
      );
    } catch {
      setServerError(t("admin.sessions.endFail"));
    } finally {
      inFlight.current = false;
      setEnding(false);
    }
  }

  const doneOrders = detail ? detail.orders.filter((o) => o.status === "done") : [];
  const elapsed =
    detail && nowMs > 0 ? nowMs - new Date(detail.check_in).getTime() : 0;

  const canSubmit =
    !!detail && !ending && !loadError && (!hasValue || !localErrorKey);

  return createPortal(
    <div
      className="session-panel-backdrop"
      role="presentation"
      onClick={onClose}
      onKeyDown={onBackdropKeyDown}
    >
      <div
        className="session-panel end-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("admin.end.title")}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="bottom-sheet-handle" aria-hidden="true" />

        <div className="session-panel-head">
          <div className="session-panel-head-text">
            <span className="badge badge-live">
              <span className="pulse-dot" />
              {t("admin.sessions.end")}
            </span>
            <h3 className="session-panel-name">
              {detail ? detail.student_name : t("common.loading")}
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

        {loadError && <p className="text-sm text-danger">{loadError}</p>}

        {!detail && !loadError && (
          <div className="flex flex-col gap-3">
            <div className="skeleton-line h-24 w-full rounded-xl" />
            <div className="skeleton-line h-4 w-2/3 rounded-md" />
            <div className="skeleton-line h-4 w-1/2 rounded-md" />
            <p className="text-sm text-muted">{t("admin.end.loading")}</p>
          </div>
        )}

        {detail && (
          <>
            <dl className="session-facts">
              <div className="session-fact">
                <dt>{t("admin.session.checkIn")}</dt>
                <dd dir="ltr">
                  {new Date(detail.check_in).toLocaleString()}
                </dd>
              </div>
              <div className="session-fact">
                <dt>{t("admin.end.duration")}</dt>
                <dd dir="ltr" className="tabular-nums">
                  {formatDuration(elapsed)}
                </dd>
              </div>
              <div className="session-fact">
                <dt>{t("admin.col.billable")}</dt>
                <dd className="tabular-nums">
                  {detail.preview.billable_hours}{" "}
                  <span className="text-muted">{t("common.hourShort")}</span>
                </dd>
              </div>
              <div className="session-fact">
                <dt>{t("admin.end.hoursFee")}</dt>
                <dd className="tabular-nums">
                  {formatThousands(detail.preview.hours_amount)}{" "}
                  <span className="text-muted">{t("admin.currency")}</span>
                </dd>
              </div>
              <div className="session-fact">
                <dt>{t("admin.end.ordersFee")}</dt>
                <dd className="tabular-nums">
                  {formatThousands(detail.preview.orders_amount)}{" "}
                  <span className="text-muted">{t("admin.currency")}</span>
                </dd>
              </div>
            </dl>

            <div className="session-orders">
              <div className="session-orders-head">
                <h4 className="admin-section-title mb-0">
                  {t("admin.session.orders")}
                </h4>
                <span className="price-chip tabular-nums">
                  {doneOrders.length}
                </span>
              </div>
              {doneOrders.length === 0 ? (
                <p className="text-sm text-muted">{t("admin.session.noOrders")}</p>
              ) : (
                <ul className="session-order-list">
                  {doneOrders.map((o) => (
                    <li key={o.id} className="session-order">
                      <span className="session-order-name">
                        {o.service_name}
                        {o.units > 1 && (
                          <span className="text-muted tabular-nums">
                            {" × "}
                            {o.units}
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums">
                        {formatThousands(o.total)}{" "}
                        <span className="text-muted">{t("admin.currency")}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ── الخصم الاختياري ─────────────────────────── */}
            <div className="end-discount">
              <h4 className="admin-section-title mb-0">
                {t("admin.end.discountSection")}
              </h4>

              <div className="field">
                <span className="label">{t("admin.end.scopeLabel")}</span>
                <div className="end-chip-row" role="group">
                  {SCOPE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`btn-option${scope === s ? " is-active" : ""}`}
                      aria-pressed={scope === s}
                      onClick={() => pickScope(s)}
                    >
                      {t(`admin.end.scope.${s}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span className="label">{t("admin.end.typeLabel")}</span>
                <div className="end-chip-row" role="group">
                  {TYPE_OPTIONS.map((tp) => {
                    const disabled = tp === "free_hours" && scope !== "hours";
                    return (
                      <button
                        key={tp}
                        type="button"
                        className={`btn-option${type === tp ? " is-active" : ""}`}
                        aria-pressed={type === tp}
                        disabled={disabled && type !== tp}
                        onClick={() => pickType(tp)}
                      >
                        {t(`admin.end.type.${tp}`)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="end-discount-value">
                  {t("admin.end.value")}
                </label>
                <div className="end-value-row">
                  <input
                    id="end-discount-value"
                    className="input"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    dir="ltr"
                    value={valueStr}
                    onChange={(e) => setValueStr(e.target.value)}
                  />
                  <span className="end-value-suffix">
                    {type === "percent"
                      ? t("admin.end.valueSuffix.percent")
                      : type === "fixed"
                        ? t("admin.end.valueSuffix.fixed")
                        : t("admin.end.valueSuffix.free_hours")}
                  </span>
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="end-discount-note">
                  {t("admin.end.note")}
                </label>
                <input
                  id="end-discount-note"
                  className="input"
                  type="text"
                  maxLength={200}
                  placeholder={t("admin.end.notePlaceholder")}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {localErrorKey && (
                <p className="text-sm text-danger" role="alert">
                  {t(localErrorKey)}
                </p>
              )}
            </div>

            {/* ── المجموع والمبلغ النهائي (إعادة حساب لحظية) ── */}
            <dl className="session-facts end-summary">
              <div className="session-fact">
                <dt>{t("admin.end.gross")}</dt>
                <dd className="tabular-nums">
                  {formatThousands(detail.preview.gross_total)}{" "}
                  <span className="text-muted">{t("admin.currency")}</span>
                </dd>
              </div>
              <div className="session-fact">
                <dt>{t("admin.end.willDeduct")}</dt>
                <dd className="tabular-nums text-danger">
                  {hasValue && !localErrorKey
                    ? `− ${formatThousands(liveAmount)} ${t("admin.currency")}`
                    : t("admin.end.noDiscount")}
                </dd>
              </div>
              <div className="session-fact end-final">
                <dt>{t("admin.end.final")}</dt>
                <dd className="tabular-nums">
                  {formatThousands(liveFinal)}{" "}
                  <span className="text-muted">{t("admin.currency")}</span>
                </dd>
              </div>
            </dl>

            {serverError && (
              <p className="text-sm text-danger" role="alert">
                {serverError}
              </p>
            )}

            <div className="session-panel-actions end-actions">
              <button
                type="button"
                className="btn btn-danger px-4 py-2 text-sm"
                onClick={confirmEnd}
                disabled={!canSubmit}
              >
                {ending ? t("admin.end.ending") : t("admin.end.confirm")}
              </button>
              <button
                type="button"
                className="btn btn-ghost px-4 py-2 text-sm"
                onClick={onClose}
                disabled={ending}
              >
                {t("common.cancel")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
