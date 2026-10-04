"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// يُركّب من صفحة /session/[id] (server) عندما تكون الجلسة منتهية
// أصلاً: يوجه لصفحة "/ended" عبر router.replace بدل redirect()
// من جهة الخادم — لأن replace يستبدل عنوان /session الحالي في
// سجل التصفح فلا يبقى خلف /ended عنوان /session يوقع زر الرجوع
// في حلقة إعادة توجيه لا نهائية.
// ============================================================
export function EndedRedirect({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/session/${sessionId}/ended`);
  }, [router, sessionId]);

  return null;
}