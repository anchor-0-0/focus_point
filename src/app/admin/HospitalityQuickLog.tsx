"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";

// ============================================================
// Ø²Ø± + Ù†Ø§ÙØ°Ø© Â«ØªØ³Ø¬ÙŠÙ„ Ø¶ÙŠØ§ÙØ© Ø³Ø±ÙŠØ¹Ø©Â» â€” ÙŠØ¸Ù‡Ø± ÙÙŠ Ø§Ù„Ù‡ÙŠÙƒÙ„ Ø§Ù„Ø¹Ø§Ù…
// (AdminChrome) ÙˆØ±Ø£Ø³ Ù‚Ø³Ù… Ø§Ù„Ø¶ÙŠØ§ÙØ©.
// ------------------------------------------------------------
// Ø§Ù„Ù…Ø³Ø§Ø± Ø§Ù„Ø´Ø§Ø¦Ø¹ Ø¨Ù†Ù‚Ø±ØªÙŠÙ†-3: Ø§Ù„Ù†ÙˆØ¹ ÙˆØ§Ù„ØµÙ†Ù Ù…Ø­ÙÙˆØ¸Ø§Ù† Ù…Ù† Ø¢Ø®Ø± Ø§Ø³ØªØ®Ø¯Ø§Ù…
// (localStorage) â†’ ÙØªØ­ Ø§Ù„Ù†Ø§ÙØ°Ø© â† (Ø§Ø®ØªÙŠØ§Ø± ØµÙ†Ù Ø¥Ù† Ù„Ø²Ù…) â† Ø­ÙØ¸.
// Ø§Ù„Ø£ØµÙ†Ø§Ù: Ø§Ù„Ø¨ÙˆÙÙŠÙ‡ ÙÙ‚Ø· â€” Ù†Ø³ØªØ¨Ø¹Ø¯ ØªØµÙ†ÙŠÙ Ø§Ù„Ø·Ø¨Ø§Ø¹Ø©/Print.
// ============================================================

type Service = { id: string; name: string; category: string | null; price: number };
type Recipient = { id: string; name: string; type: string; is_active: boolean };

const LS_TYPE = "fp_hosp_type";
const LS_SERVICE = "fp_hosp_service";

function isBuffet(s: Service) {
  return !/Ø·Ø¨Ø§Ø¹Ø©|print/i.test(s.category ?? "");
}

export function HospitalityQuickLogButton({
  onSaved,
  compact = false,
}: {
  onSaved?: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={
          compact
            ? "btn btn-ghost whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs"
            : "btn btn-option whitespace-nowrap rounded-lg px-3 py-2 text-sm"
        }
        onClick={() => setOpen(true)}
      >
        {t("admin.hospitality.quickBtn")}
      </button>
      {open && (
        <HospitalityQuickLogModal
          onClose={() => setOpen(false)}
          onSaved={() => onSaved?.()}
        />
      )}
    </>
  );
}

export function HospitalityQuickLogModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const { showToast } = useToast();

  const [services, setServices] = useState<Service[] | null>(null);
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [type, setType] = useState<"guest" | "management">(() => {
    if (typeof window === "undefined") return "guest";
    return window.localStorage.getItem(LS_TYPE) === "management"
      ? "management"
      : "guest";
  });
  const [guestLabel, setGuestLabel] = useState("");
  const [peopleStr, setPeopleStr] = useState("1");
  const [recipientId, setRecipientId] = useState("");
  const [addingName, setAddingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [serviceId, setServiceId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(LS_SERVICE) ?? "";
  });
  const [qtyStr, setQtyStr] = useState("1");
  const [note, setNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [svcRes, recRes] = await Promise.all([
          fetch("/api/admin/services", { cache: "no-store" }),
          fetch("/api/admin/hospitality/recipients?type=management", {
            cache: "no-store",
          }),
        ]);
        const svcJson = await svcRes.json().catch(() => null);
        const recJson = await recRes.json().catch(() => null);
        if (cancelled) return;
        if (!svcJson?.ok) {
          setLoadError(t("admin.hospitality.loadFail"));
          return;
        }
        setServices(svcJson.services.filter(isBuffet));
        setRecipients(
          (recJson?.recipients ?? []).filter((r: Recipient) => r.is_active)
        );
        // ØµÙ†Ù Ø¢Ø®Ø± Ø§Ø³ØªØ®Ø¯Ø§Ù… Ù‚Ø¯ ÙŠÙƒÙˆÙ† Ù‚Ø¯ Ø­ÙØ°Ù â†’ Ù†Ù„ØºÙŠ Ø§Ù„Ø§Ø®ØªÙŠØ§Ø±.
        const savedId = window.localStorage.getItem(LS_SERVICE);
        if (savedId && !svcJson.services.some((s: Service) => s.id === savedId)) {
          window.localStorage.removeItem(LS_SERVICE);
          setServiceId("");
        }
      } catch {
        if (!cancelled) setLoadError(t("admin.hospitality.loadFail"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const addName = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/admin/hospitality/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type: "management" }),
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        setError(t(json?.error ?? "admin.hospitality.nameFail"));
        return;
      }
      setRecipients((prev) => {
        const list = (prev ?? []).filter((r) => r.id !== json.recipient.id);
        return [
          ...list,
          {
            id: json.recipient.id,
            name: json.recipient.name,
            type: json.recipient.type,
            is_active: true,
          },
        ];
      });
      setRecipientId(json.recipient.id);
      setNewName("");
      setAddingName(false);
      setError(null);
      showToast(t("admin.hospitality.nameSaved"));
    } catch {
      setError(t("admin.hospitality.nameFail"));
    }
  }, [newName, t, showToast]);

  const submit = useCallback(async () => {
    if (inFlight.current) return;
    const quantity = Number(qtyStr);
    const guestsCount = Number(peopleStr);

    if (type === "guest" && !guestLabel.trim()) {
      setError(t("admin.hospitality.needGuest"));
      return;
    }
    if (type === "management" && !recipientId) {
      setError(t("admin.hospitality.needName"));
      return;
    }
    if (!serviceId) {
      setError(t("admin.hospitality.needService"));
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError(t("admin.hospitality.needService"));
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/hospitality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: serviceId,
          recipient_type: type,
          recipient_id: type === "management" ? recipientId : null,
          guest_label: type === "guest" ? guestLabel.trim() : null,
          quantity,
          guests_count:
            type === "management" &&
            Number.isInteger(guestsCount) &&
            guestsCount >= 1
              ? guestsCount
              : 1,
          note: note.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        setError(t(json?.error ?? "admin.hospitality.saveFail"));
        return;
      }
      window.localStorage.setItem(LS_TYPE, type);
      window.localStorage.setItem(LS_SERVICE, serviceId);
      showToast(t("admin.hospitality.saved"));
      onSaved?.();
      onClose();
    } catch {
      setError(t("admin.hospitality.saveFail"));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [
    qtyStr,
    peopleStr,
    type,
    guestLabel,
    recipientId,
    serviceId,
    note,
    t,
    showToast,
    onSaved,
    onClose,
  ]);

  const selected = services?.find((s) => s.id === serviceId) ?? null;

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
        aria-label={t("admin.hospitality.quickTitle")}
      >
        <div className="session-panel-head">
          <div className="session-panel-head-text">
            <h3 className="session-panel-name">
              {t("admin.hospitality.quickTitle")}
            </h3>
            <p className="session-panel-sub">
              {t("admin.hospitality.quickSub")}
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
          {loadError && (
            <p className="text-sm text-danger" role="alert">
              {loadError}
            </p>
          )}

          {/* Ø§Ù„Ù†ÙˆØ¹: Ø¶ÙŠÙ / Ø¥Ø¯Ø§Ø±Ø© */}
          <div className="field">
            <span className="label">{t("admin.hospitality.who")}</span>
            <div className="end-chip-row" role="group">
              <button
                type="button"
                className={`btn btn-option rounded-lg px-4 py-2 text-sm${type === "guest" ? " is-active" : ""}`}
                onClick={() => setType("guest")}
              >
                {t("admin.hospitality.guest")}
              </button>
              <button
                type="button"
                className={`btn btn-option rounded-lg px-4 py-2 text-sm${type === "management" ? " is-active" : ""}`}
                onClick={() => setType("management")}
              >
                {t("admin.hospitality.management")}
              </button>
            </div>
          </div>

          {type === "guest" ? (
            <div className="field">
              <label className="label" htmlFor="hosp-guest-name">
                {t("admin.hospitality.guestName")}
              </label>
              <input
                id="hosp-guest-name"
                className="input"
                value={guestLabel}
                maxLength={60}
                placeholder={t("admin.hospitality.guestNamePh")}
                onChange={(e) => setGuestLabel(e.target.value)}
              />
            </div>
          ) : (
            <div className="field">
              <span className="label">
                {t("admin.hospitality.pickName")}
              </span>
              <div className="hosp-chip-wrap">
                {(recipients ?? []).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`btn btn-option rounded-full px-3 py-1.5 text-xs${recipientId === r.id ? " is-active" : ""}`}
                    onClick={() => setRecipientId(r.id)}
                  >
                    {r.name}
                  </button>
                ))}
                {addingName ? (
                  <span className="hosp-inline-add">
                    <input
                      className="input hosp-inline-input"
                      value={newName}
                      maxLength={60}
                      autoFocus
                      placeholder={t("admin.hospitality.newNamePh")}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void addName();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-option rounded-lg px-2.5 py-1 text-xs"
                      onClick={() => void addName()}
                    >
                      {t("admin.hospitality.add")}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost rounded-full px-3 py-1.5 text-xs"
                    onClick={() => setAddingName(true)}
                  >
                    + {t("admin.hospitality.newName")}
                  </button>
                )}
              </div>
              {(recipients ?? []).length === 0 && !addingName && (
                <p className="mt-1.5 text-xs text-muted">
                  {t("admin.hospitality.noNames")}
                </p>
              )}
              <label className="label hosp-people-label" htmlFor="hosp-people">
                {t("admin.hospitality.people")}
              </label>
              <input
                id="hosp-people"
                className="input hosp-qty"
                type="number"
                min={1}
                max={999}
                value={peopleStr}
                onChange={(e) => setPeopleStr(e.target.value)}
              />
            </div>
          )}

          {/* Ø§Ù„ØµÙ†Ù */}
          <div className="field">
            <span className="label">{t("admin.hospitality.service")}</span>
            <div className="hosp-chip-wrap">
              {(services ?? []).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`btn btn-option rounded-full px-3 py-1.5 text-xs${serviceId === s.id ? " is-active" : ""}`}
                  onClick={() => setServiceId(s.id)}
                >
                  {s.name}
                  <span className="hosp-chip-price tabular-nums">
                    {s.price}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="hosp-row">
            <div className="field">
              <label className="label" htmlFor="hosp-qty">
                {t("admin.hospitality.qty")}
              </label>
              <input
                id="hosp-qty"
                className="input hosp-qty"
                type="number"
                min={1}
                max={999}
                value={qtyStr}
                onChange={(e) => setQtyStr(e.target.value)}
              />
            </div>
            <div className="field hosp-note-field">
              <label className="label" htmlFor="hosp-note">
                {t("admin.hospitality.note")}
              </label>
              <input
                id="hosp-note"
                className="input"
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          {selected && (
            <p className="hosp-estimate tabular-nums">
              {t("admin.hospitality.statValue")}:{" "}
              {Number((selected.price * Number(qtyStr || 0)).toFixed(2))}
            </p>
          )}

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="session-panel-actions end-actions">
          <button
            type="button"
            className="btn btn-ghost rounded-lg px-4 py-2 text-sm"
            onClick={onClose}
            disabled={saving}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary rounded-lg px-5 py-2 text-sm"
            onClick={() => void submit()}
            disabled={saving || !!loadError}
          >
            {saving
              ? t("admin.hospitality.saving")
              : t("admin.hospitality.saveEntry")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
