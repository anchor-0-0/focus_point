"use client";

import { useEffect } from "react";
import { clearStoredActiveSessionId } from "@/lib/active-session";

// ============================================================
// يُركّب في صفحة "انتهت الجلسة" — يمسح fp_active_session_id من
// localStorage بمجرد التحميل، أياً كان الطريق الذي أوصل للصفحة
// (تساؤل دوري، استجابة 409 للخدمات، أو توجيه server-side).
// هكذا لا يعلق الطالب بحلقة إعادة توجيه لجلسة منتهية إذا ضغط
// زر الرجوع بعدها، وتظهر له فورم تسجيل جديدة بشكل طبيعي.
// ============================================================
export function ClearActiveSession() {
  useEffect(() => {
    clearStoredActiveSessionId();
    try {
      localStorage.removeItem("demo_session_info");
      localStorage.removeItem("demo_student_name");
      localStorage.removeItem("demo_student_phone");
    } catch {}
  }, []);

  return null;
}