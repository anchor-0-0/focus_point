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
  const checkInMs = checkInIso ? new Date(checkInIso).getTime() : 0;

  const skewRef = useRef<number>(0);
  const seededRef = useRef<boolean>(false);

  // حساب فوري متزامن على أول تصيير (يبدأ العدّ فوراً دون أي تأخير أو انتظار)
  const [elapsedMs, setElapsedMs] = useState<number>(() => {
    if (!checkInMs || isNaN(checkInMs)) return 0;
    return Math.max(0, Date.now() - checkInMs);
  });

  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      if (serverNowIso) {
        const diff = new Date(serverNowIso).getTime() - Date.now();
        // نتجاهل أي serverNowIso قديم ناتج عن التوليد المسبق (أكثر من 30 ثانية فرق)
        if (Math.abs(diff) < 30_000) {
          skewRef.current = diff;
        } else {
          skewRef.current = 0;
        }
      }
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      if (!checkInMs || isNaN(checkInMs)) {
        setElapsedMs(0);
        return;
      }
      setElapsedMs(Math.max(0, Date.now() + skewRef.current - checkInMs));
    };

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

  // تصحيح فرق الساعات من موقّت الخادم الطازج (رقمي أو ISO string).
  const recalibrate = useCallback(
    (serverNow: number | string) => {
      const serverNowMs =
        typeof serverNow === "number"
          ? serverNow
          : typeof serverNow === "string"
          ? new Date(serverNow).getTime()
          : NaN;

      if (!isNaN(serverNowMs)) {
        skewRef.current = serverNowMs - Date.now();
        if (checkInMs) {
          setElapsedMs(Math.max(0, Date.now() + skewRef.current - checkInMs));
        }
      }
    },
    [checkInMs]
  );

  return { elapsedMs, recalibrate };
}