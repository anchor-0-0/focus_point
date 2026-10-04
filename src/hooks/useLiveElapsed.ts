"use client";

// عدّاد حي لمدة الجلسة — جذر المشكلة السابقة أن العدّاد كان يعتمد على
// "serverNowIso" الملتقط لحظة التصيير، فيعود للوراء عند الرجوع من صفحة
// الخدمات (كاش راوتر Next يعيد حزمة قديمة). الحل: نثبّت العدّاد على وقت
// الدخول المطلق من قاعدة البيانات (checkInIso — لا يتغير) ونعدّ من ساعة
// الجهاز، مع تصحيح فرق الساعات (skew) من موقّت الخادم الطازج عند كل poll.

import { useCallback, useEffect, useRef, useState } from "react";

export function useLiveElapsed(
  checkInIso?: string | null,
  serverNowIso?: string | null
) {
  // ما يعرضه العدّاد يعتمد كلياً على وقت الدخول من قاعدة البيانات،
  // لذا أي رجوع للصفحة يحسبه من جديد بموقّت حقيقي بدل كاش قديم.
  const checkInMs = checkInIso ? new Date(checkInIso).getTime() : 0;

  // فرق ساعات العميل عن الخادم — بذرة أولية تُزرع مرة واحدة بعد التركيب
  // (خارج التصيير لتبقى خالصة)، ثم تُصحَّح تلقائياً عبر recalibrate من
  // موقّت الخادم الطازج عند كل poll.
  const skewRef = useRef<number>(0);
  const seededRef = useRef<boolean>(false);

  const [elapsedMs, setElapsedMs] = useState<number>(0);

  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      if (serverNowIso) {
        skewRef.current = new Date(serverNowIso).getTime() - Date.now();
      }
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      if (!checkInMs) {
        setElapsedMs(0);
        return;
      }
      setElapsedMs(Math.max(0, Date.now() + skewRef.current - checkInMs));
    };

    // نُسق كل نبضة مع حدود الثانية الحقيقية: لو تأخّرت النبضة (تبويب مخفي أو
    // تصيير ثقيل) تُلتقط في حدود الثانية التالية بدل أن ينكسر الإيقاع.
    const schedule = () => {
      timeout = setTimeout(() => {
        tick();
        schedule();
      }, 1000 - (Date.now() % 1000));
    };

    tick();
    schedule();

    return () => {
      if (timeout !== undefined) clearTimeout(timeout);
    };
  }, [checkInMs, serverNowIso]);

  // تصحيح فرق الساعات من موقّت الخادم الطازج (رقمي: server_now بالمللي).
  const recalibrate = useCallback(
    (serverNowMs: number) => {
      skewRef.current = serverNowMs - Date.now();
      setElapsedMs(Math.max(0, Date.now() + skewRef.current - checkInMs));
    },
    [checkInMs]
  );

  return { elapsedMs, recalibrate };
}