"use client";

// ============================================================
// مراقب الطلبات الجديدة — يعمل على كل صفحات لوحة الأدمن
// ------------------------------------------------------------
// كان التنبيه (toast + صوت + نبض) محبوساً داخل OrdersFeed المركّب
// في /admin/orders وحدها، فلا يسمع الأدمن بشيء وهو ينظر إلى
// الداشبورد أو الجلسات أو التقارير. هذا المكوّن يركّب في هيكل
// اللوحة (AdminChrome) فيستقبل الطلبات الواردة أينما كان الأدمن.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/components/LanguageProvider";
import { usePolling } from "@/lib/admin-hooks";
import { POLL_ORDERS_MS } from "@/lib/admin-poll";

type WatchedOrder = {
  id: string;
  student_name: string;
  service_name: string;
};

// كتم الصوت على مستوى التبويب (زر الجرس في صفحة الطلبات يضبطه).
// نتركه في عنصر مشترك حتى يتفق الزر مع هذا المراقب.
export const ordersSound = { muted: false };

export function NewOrdersWatcher() {
  const { showToast } = useToast();
  const { t, tw } = useI18n();

  const [pulse, setPulse] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [muted, setMuted] = useState(ordersSound.muted);
  // زر إذن الإشعارات معرّف بالمتصفح فقط — نؤخره بعد التركيب ليطابق HTML الخادم.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  const inFlight = useRef(false);
  const audioCtxRef = useRef<AudioContext | null | undefined>(undefined);

  // الطلبات المرصودة (بالمعرّف لا بالعدد) + علم أول جلب.
  const alertedRef = useRef<Set<string>>(new Set());
  const baselineDone = useRef(false);
  const titleBaseRef = useRef<string | null>(null);

  // تهيئة سياق الصوت عند أول تفاعل حقيقي — المتصفحات تمنع الصوت
  // التلقائي قبل أول نقرة، فبدونها لا يسمع الجرس ولو وصل الطلب.
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

  // نغمة قصيرة هادئة: نغمتان ناعمتان (E5 ثم A5) بتلاشٍ سريع.
  const playChime = useCallback(() => {
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
  }, []);

  // نافذة Detection API إن دعمها المتصفح: يغيّر العنوان ويلعب
  // تنبيها حتى مع وجود تبويب آخر في المقدمة.
  const notify = useCallback(
    (orders: WatchedOrder[]) => {
      if (typeof document !== "undefined" && "title" in document) {
        const marker = t("admin.orders.newAlert");
        // نحفظ العنوان الأصلي مرة واحدة (قبل أي تنبيه) لنعيده لاحقاً.
        if (!titleBaseRef.current) titleBaseRef.current = document.title;
        document.title = `${marker} (${orders.length}) — ${titleBaseRef.current}`;
      }

      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          for (const o of orders) {
            new Notification(t("admin.orders.newAlert"), {
              body: tw("admin.orders.newOrder", {
                student: o.student_name,
                service: o.service_name,
              }),
              tag: `fp-order-${o.id}`,
            });
          }
        }
      } catch {
        // لا دعم للإشعارات — التست والجرس يكفيان.
      }
    },
    [t, tw]
  );

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) return;

      const incoming: WatchedOrder[] = data.orders ?? [];
      setPendingCount(incoming.length);

      if (!baselineDone.current) {
        // أول جلب = خط أساس: تعريف القائمة بلا أي تنبيه.
        for (const o of incoming) alertedRef.current.add(o.id);
        baselineDone.current = true;
        return;
      }

      const fresh = incoming.filter((o) => !alertedRef.current.has(o.id));
      if (fresh.length === 0) return;

      for (const o of fresh) alertedRef.current.add(o.id);
      setPulse(true);
      notify(fresh);
      for (const o of fresh) {
        showToast(
          tw("admin.orders.newOrder", {
            student: o.student_name,
            service: o.service_name,
          }),
          "info",
          4500
        );
      }
      playChime();
    } catch {
      // فشل شبكة عابر — نتجاهل ونكمل الدورة التالية.
    } finally {
      inFlight.current = false;
    }
  }, [notify, playChime, showToast, tw]);

  usePolling(load, POLL_ORDERS_MS);

  // إيقاف النبضة بعد 1.2 ثانية.
  useEffect(() => {
    if (!pulse) return;
    const id = setTimeout(() => setPulse(false), 1200);
    return () => clearTimeout(id);
  }, [pulse]);

// إعادة عنوان الصفحة عند عودة النافذة إلى المقدمة أو إغلاق التنبيه.
useEffect(() => {
    const restore = () => {
      if (titleBaseRef.current && document.title !== titleBaseRef.current) {
        document.title = titleBaseRef.current;
        alertedRef.current.clear();
        baselineDone.current = false;
      }
    };
    window.addEventListener("focus", restore);
    return () => window.removeEventListener("focus", restore);
  }, []);

  // زر الجرس وكتم الصوت — يعمل في كل الصفحات.
  const toggleMute = () => {
    ordersSound.muted = !ordersSound.muted;
    setMuted(ordersSound.muted);
    if (!ordersSound.muted) playChime();
  };

  const askPermission = () => {
    if (typeof Notification === "undefined") return;
    void Notification.requestPermission();
  };

  return (
    <div
      className="no-print fixed bottom-4 end-4 z-50 flex items-center gap-2"
      aria-live="polite"
    >
      {pulse && (
        <span
          className="pointer-events-none absolute -inset-2 rounded-full"
          style={{
            boxShadow: "0 0 0 6px var(--color-accent-soft, rgba(180,120,40,0.18))",
            animation: "fp-pulse-ring 1.2s ease-out forwards",
          }}
          aria-hidden="true"
        />
      )}

      <a
        href="/admin/orders"
        className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs shadow-lg transition hover:bg-surface-soft"
        title={t("admin.nav.orders")}
      >
        <span className={pulse ? "pulse-dot" : "h-2.5 w-2.5 rounded-full bg-accent"} />
        {pendingCount !== null && (
          <span className="tabular-nums font-semibold text-foreground">
            {pendingCount}
          </span>
        )}
        {pulse && (
          <span className="font-semibold text-accent">{t("admin.orders.newAlert")}</span>
        )}
      </a>

      <button
        type="button"
        onClick={toggleMute}
        aria-pressed={muted}
        title={muted ? t("admin.orders.muteOff") : t("admin.orders.muteOn")}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface shadow-lg transition hover:bg-surface-soft"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          {muted ? (
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
      </button>

      {mounted && typeof Notification !== "undefined" && Notification.permission === "default" && (
        <button
          type="button"
          onClick={askPermission}
          title={t("admin.orders.enableNotifications")}
          className="flex h-9 items-center justify-center rounded-full border border-border bg-surface px-3 text-xs shadow-lg transition hover:bg-surface-soft"
        >
          {t("admin.orders.enableNotifications")}
        </button>
      )}
    </div>
  );
}
