"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePolling } from "@/lib/admin-hooks";
import { POLL_ORDERS_MS } from "@/lib/admin-poll";
import { useToast } from "@/components/Toast";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonLines } from "@/components/SkeletonLines";
import { useI18n } from "@/components/LanguageProvider";
import { formatThousands } from "@/lib/money";
import { orderTotal, orderUnits, type OrderDetails } from "@/lib/orders";
import { ordersSound } from "./NewOrdersWatcher";

type OrderRow = {
  id: string;
  service_name: string;
  price: number;
  details: OrderDetails | null;
  student_name: string;
  spot_label: string | null;
  created_at: string;
};

// ============================================================
// عرض الطلبات المعلّقة. التنبيه (toast + صوت + نبض + إشعار متصفح)
// مسؤول عنه الآن NewOrdersWatcher المركّب في هيكل اللوحة، فيعمل في
// كل الصفحات بلا ازدواج هنا.
// ============================================================

export function OrdersFeed() {
  const { showToast } = useToast();
  const { t, tw } = useI18n();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pulsing, setPulsing] = useState(false);
  const [mutedUi, setMutedUi] = useState(ordersSound.muted);
  // أول جلب: حتى لا "تومض" رسالة "لا توجد طلبات" قبل وصول أول بيانات.
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const inFlight = useRef(false);
  const audioCtxRef = useRef<AudioContext | null | undefined>(undefined);
  const alertedOrderIds = useRef<Set<string>>(new Set());
  const baselineDone = useRef(false);

  // تهيئة صوت الجرس عند أول تفاعل حقيقي (نقرة/لمس/زر).
  useEffect(() => {
    const prime = () => {
      if (audioCtxRef.current === undefined) {
        try {
          const Ctor: typeof AudioContext | undefined =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          audioCtxRef.current = Ctor ? new Ctor() : null;
        } catch {
          audioCtxRef.current = null;
        }
      }
      audioCtxRef.current?.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", prime, { once: true });
    window.addEventListener("keydown", prime, { once: true });
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, []);

  // نغمة قصيرة هادئة عند كتم解除 (نفس نغمة المراقب العام).
  function playChime() {
    if (ordersSound.muted) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    if (ctx.state !== "running") return;
    const t0 = ctx.currentTime + 0.02;
    [659.25, 880.0].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = t0 + i * 0.13;
      const dur = 0.24;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.11, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    });
  }

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        const incoming: OrderRow[] = data.orders;
        setOrders(incoming);
        setError(null);

        // نبض محلي فقط (مرئي) — التنبيه والجرس للإشعار يتولاهما
        // NewOrdersWatcher، فلا يتكرر الصوت أو الـ toast في هذه الصفحة.
        if (!baselineDone.current) {
          for (const o of incoming) alertedOrderIds.current.add(o.id);
          baselineDone.current = true;
        } else {
          const fresh = incoming.filter(
            (o) => !alertedOrderIds.current.has(o.id)
          );
          if (fresh.length > 0) {
            for (const o of fresh) alertedOrderIds.current.add(o.id);
            setPulsing(true);
          }
        }
        setFirstLoadDone(true);
      } else {
        setError(data.error ?? t("admin.orders.loadFail"));
      }
    } catch {
      setError(t("admin.err.network"));
    } finally {
      inFlight.current = false;
    }
  }, [t]);

  usePolling(load, POLL_ORDERS_MS);

  // إيقاف النبضة بعد 1.2 ثانية.
  useEffect(() => {
    if (!pulsing) return;
    const id = setTimeout(() => setPulsing(false), 1200);
    return () => clearTimeout(id);
  }, [pulsing]);

  const [cleaning, setCleaning] = useState(false);


  async function clearAllUploads() {
    if (cleaning) return;
    setCleaning(true);
    try {
      const res = await fetch("/api/admin/files/cleanup", {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        showToast(tw("admin.orders.cleaned", { n: data.deleted ?? 0 }), "success");
      } else {
        showToast(data?.error ?? t("admin.orders.cleanFail"), "error");
      }
    } catch {
      showToast(t("admin.err.network"), "error");
    } finally {
      setCleaning(false);
    }
  }

  const toggleMute = () => {
    ordersSound.muted = !ordersSound.muted;
    setMutedUi(ordersSound.muted);
    if (!ordersSound.muted) playChime();
  };

  async function markDone(orderId: string) {
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });
      if (res.ok) {
        await load();
        showToast(t("admin.orders.updated"), "success");
      } else {
        const data = await res.json().catch(() => null);
        showToast(data?.error ?? t("admin.orders.updateFail"), "error");
      }
    } catch {
      setError(t("admin.orders.updateFail"));
      showToast(t("admin.orders.updateFail"), "error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={clearAllUploads}
            disabled={cleaning}
            className="btn btn-option px-3 py-1.5 text-xs"
            title={t("admin.orders.cleanupTitle")}
          >
            {cleaning ? (
              t("admin.orders.cleaning")
            ) : (
              <>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
                {t("admin.orders.cleanup")}
              </>
            )}
          </button>

          <span className="badge badge-pending">
            {pulsing ? <span className="pulse-dot" /> : <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
            {tw("admin.orders.pendingCount", { n: orders.length })}
          </span>
        {pulsing && <span className="text-sm text-accent">{t("admin.orders.newAlert")}</span>}

        <button
          type="button"
          className="ms-auto btn btn-option px-3 py-1.5 text-xs"
          onClick={toggleMute}
          title={mutedUi ? t("admin.orders.muteOff") : t("admin.orders.muteOn")}
          aria-pressed={mutedUi}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="inline-block"
          >
            <path d="M11 5 6 9H2v6h4l5 4V5Z" />
            {mutedUi ? (
              <>
                <path d="m23 9-6 6" />
                <path d="m17 9 6 6" />
              </>
            ) : (
              <>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </>
            )}
          </svg>
          <span className="ms-1">{mutedUi ? t("admin.orders.soundMuted") : t("admin.orders.soundOn")}</span>
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {!firstLoadDone ? (
        <SkeletonLines rows={3} />
      ) : orders.length === 0 ? (
        <EmptyState title={t("admin.orders.empty")} hint={t("admin.orders.emptyHint")} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((o) => {
            const details = o.details;
            const isPrint =
              !!details?.file_path && !!details?.print_type && !!details?.copies;
            const fileSize =
              details?.file_size != null
                ? details.file_size >= 1024 * 1024
                  ? `${(details.file_size / (1024 * 1024)).toFixed(1)} MB`
                  : `${(details.file_size / 1024).toFixed(0)} KB`
                : null;
            return (
              <article
                key={o.id}
                className="rounded-xl border border-border bg-surface p-4"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{o.service_name}</h3>
                    <p className="text-xs text-muted">
                      {o.student_name} • {o.spot_label ?? "—"}
                    </p>
                  </div>
                  <span className="price-chip">{formatThousands(o.price)} {t("admin.currency")}</span>
                </div>

                {/* طلب طباعة: تفاصيل واضحة + زر تحميل الملف المرفوع */}
                {isPrint && details ? (
                  <dl className="mt-3 space-y-1 text-sm text-muted">
                    <div className="flex justify-between gap-2">
                      <dt>{t("admin.orders.fileField")}</dt>
                      <dd className="truncate" title={details.file_name}>
                        {details.file_name}
                        {fileSize ? ` (${fileSize})` : ""}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>{t("admin.orders.printType")}</dt>
                      <dd>
                        {details.print_type
                          ? details.print_type === "black_white" ? t("opt.bw") : t("opt.color")
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>{t("admin.orders.copies")}</dt>
                      <dd className="tabular-nums">{details.copies}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>{t("admin.orders.paper")}</dt>
                      <dd>{details.paper ? (details.paper === "a4" ? t("opt.a4") : t("opt.booklet")) : "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>{t("admin.orders.mode")}</dt>
                      <dd>
                        {details.print_mode
                          ? details.print_mode === "single_side" ? t("opt.single") : t("opt.double")
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>{t("admin.orders.orientation")}</dt>
                      <dd>
                        {details.orientation
                          ? details.orientation === "portrait" ? t("opt.portrait") : t("opt.landscape")
                          : "—"}
                      </dd>
                    </div>
                    {details.note ? (
                      <div className="flex justify-between gap-2">
                        <dt>{t("admin.orders.note")}</dt>
                        <dd>{details.note}</dd>
                      </div>
                    ) : null}

                    <div className="pt-2">
                      <a
                        href={`/api/admin/files/${encodeURIComponent(
                          details.file_path ?? ""
                        )}?name=${encodeURIComponent(
                          details.file_name ?? "file"
                        )}&download=1`}
                        className="btn btn-primary w-full"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <path d="m7 10 5 5 5-5" />
                          <path d="M12 15V3" />
                        </svg>
                        {t("admin.orders.download")}
                      </a>
                    </div>
                  </dl>
                ) : (
                  details && (
                    <dl className="mt-3 space-y-1 text-sm text-muted">
                      {details.quantity ? (
                        <div className="flex justify-between">
                          <dt>{t("admin.orders.quantity")}</dt>
                          <dd className="tabular-nums">{details.quantity}</dd>
                        </div>
                      ) : null}
                      {details.copies ? (
                        <div className="flex justify-between">
                          <dt>{t("admin.col.qty")}</dt>
                          <dd className="tabular-nums">{details.copies}</dd>
                        </div>
                      ) : null}
                      {orderUnits(details) > 1 ? (
                        <div className="flex justify-between">
                          <dt>{t("admin.col.lineTotal")}</dt>
                          <dd className="tabular-nums">
                            {formatThousands(
                              orderTotal(o.price, details)
                            )}{" "}
                            {t("admin.currency")}
                          </dd>
                        </div>
                      ) : null}
                      {details.sugar ? (
                        <div className="flex justify-between">
                          <dt>{t("admin.orders.sugar")}</dt>
                          <dd>
                            {details.sugar === "بدون سكر"
                              ? t("sugar.none")
                              : details.sugar === "سكر خفيف"
                                ? t("sugar.light")
                                : details.sugar === "سكر متوسط"
                                  ? t("sugar.medium")
                                  : t("sugar.max")}
                          </dd>
                        </div>
                      ) : null}
                      {details.note ? (
                        <div className="flex justify-between gap-2">
                          <dt>{t("admin.orders.note")}</dt>
                          <dd>{details.note}</dd>
                        </div>
                      ) : null}
                    </dl>
                  )
                )}

                <button
                  type="button"
                  className="btn btn-primary mt-4 w-full"
                  onClick={() => markDone(o.id)}
                >
                  {t("admin.orders.done")}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}