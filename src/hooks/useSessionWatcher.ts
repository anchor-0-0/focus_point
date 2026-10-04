"use client";

// ============================================================
// مراقب حالة الجلسة — يضمن أن يرى الطالب واجهة "شكراً لزيارتك"
// أينما كان: صفحة الجلسة أم صفحة الخدمات أم نموذج طلب مفتوح.
//   - يسأل الخادم كل 5 ثوانٍ (وعند العودة للتاب فوراً).
//   - 404 أو status=ended → يمسح الجلسة المخزّنة ويبلّغ onEnded
//     لتوجيه الطالب إلى /session/[id]/ended.
//   - يعيد موقّت الخادم الطازج (server_now) لتصحيح العدّاد.
// ============================================================

import { useCallback, useEffect, useRef } from "react";
import { clearStoredActiveSessionId } from "@/lib/active-session";

const POLL_MS = 5000;

export function useSessionWatcher({
  sessionId,
  onServerNow,
  onEnded,
}: {
  sessionId: string;
  onServerNow?: (serverNowMs: number) => void;
  onEnded?: () => void;
}) {
  const inFlight = useRef(false);
  const serverNowRef = useRef(onServerNow);
  const endedRef = useRef(onEnded);

  useEffect(() => {
    serverNowRef.current = onServerNow;
    endedRef.current = onEnded;
  });

  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(`/api/session/${sessionId}/status`, {
        cache: "no-store",
      });

      // الجلسة لم تعد موجودة إطلاقاً → نفس المعنى: انتهت.
      if (res.status === 404) {
        clearStoredActiveSessionId();
        endedRef.current?.();
        return;
      }
      if (!res.ok) return;

      const data = await res.json();
      if (typeof data?.server_now === "number") {
        serverNowRef.current?.(data.server_now);
      }
      if (data?.status === "ended") {
        clearStoredActiveSessionId();
        endedRef.current?.();
      }
    } catch {
      // شبكة متقطعة: نبضات العدّاد المحلية تستمر، ونعيد المحاولة لاحقاً.
    } finally {
      inFlight.current = false;
    }
  }, [sessionId]);

  useEffect(() => {
    void check();
    const interval = setInterval(() => void check(), POLL_MS);

    // عند رجوع الطالب إلى التبويب نتحقق فوراً بدل انتظار الدورة التالية.
    const onWake = () => {
      if (document.visibilityState === "hidden") return;
      void check();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [check]);
}
