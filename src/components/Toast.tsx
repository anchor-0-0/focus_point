"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";

type ToastType = "success" | "error" | "info";

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
  exiting: boolean;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const DEFAULT_DURATION_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 250);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "success", durationMs?: number) => {
      const id = ++nextIdRef.current;
      setToasts((prev) => [...prev, { id, type, message, exiting: false }]);
      window.setTimeout(() => dismiss(id), durationMs ?? DEFAULT_DURATION_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${
              t.type === "success"
                ? "toast-success"
                : t.type === "info"
                  ? "toast-info"
                  : "toast-error"
            } ${t.exiting ? "toast-exit" : ""}`}
            onClick={() => dismiss(t.id)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {t.type === "success" ? (
                <path d="M20 6 9 17l-5-5" />
              ) : t.type === "info" ? (
                <>
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </>
              ) : (
                <>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </>
              )}
            </svg>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}