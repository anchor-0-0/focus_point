export const ACTIVE_SESSION_KEY = "fp_active_session_id";

// القراءة/الكتابة على localStorage تتم فقط على المتصفح (client-side)،
// بكل حماية من أخطاء التخزين، حتى لا يكسر أي فحص تدفق التسجيل.
export function getStoredActiveSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

export function setStoredActiveSessionId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_SESSION_KEY, id);
  } catch {
    // تجاهل صامت لأخطاء التخزين (وضع الخصوصية/امتلاء) — لا نعلّق التدفق.
  }
}

export function clearStoredActiveSessionId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // تجاهل صامت.
  }
}