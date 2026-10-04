import { useEffect } from "react";

// تساؤل دوري بسيط مع تنظيف صحيح للـ interval عند إزالة التركيب.
// كل استدعاء `fetchFn` يُنفَّذ فوراً ثم يكرر كل `intervalMs`.
// عند فشل الشبكة العابر لا نكسر الحلقة — نتجاهل ونعيد المحاولة.
export function usePolling(fetchFn: () => void, intervalMs: number) {
  useEffect(() => {
    let active = true;
    fetchFn();

    const id = setInterval(() => {
      if (!active) return;
      fetchFn();
    }, intervalMs);

    return () => {
      active = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}