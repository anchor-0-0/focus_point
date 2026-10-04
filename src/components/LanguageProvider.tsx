"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LANG,
  LANG_COOKIE,
  translate,
  type Lang,
  type DictKey,
  type MaybeEntry,
} from "@/lib/i18n";

type I18nContextValue = {
  lang: Lang;
  /** تبديل اللغة وحفظها في كوكي + تخزين محلي وتحديث واجهة فورية. */
  setLang: (lang: Lang) => void;
  /** ترجمة مفتاح قاموس أو إدخال عربي/إنجليزي إلى اللغة الحالية. */
  t: (entry: MaybeEntry | DictKey) => string;
  /** ترجمة مع استبدال {placeholders} بقيم ديناميكية. */
  tw: (key: DictKey, params: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const fromCookie = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${LANG_COOKIE}=`));
  if (fromCookie) {
    const v = fromCookie.slice(LANG_COOKIE.length + 1).trim();
    if (v === "ar" || v === "en") return v;
  }
  return DEFAULT_LANG;
}

// مدة تعتيم الصفحة (blur) أثناء تبديل اللغة بالمللي ثانية.
const SWITCH_BLUR_MS = 420;

export function LanguageProvider({
  initialLang,
  children,
}: {
  initialLang?: Lang;
  children: ReactNode;
}) {
  const router = useRouter();
  // نقرأ اللغة من الكوكي عبر useSyncExternalStore: لا setState داخل effect،
  // ولا اختلاف بين HTML المُرسَل من الخادم وما يقرأه المتصفح.
  const subscribe = useCallback(() => () => {}, []);
  const cookieLang = useSyncExternalStore(subscribe, readInitialLang, () => initialLang ?? DEFAULT_LANG);
  const [picked, setPicked] = useState<Lang | null>(null);
  const lang = picked ?? cookieLang;
  const [switching, setSwitching] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  const setLang = useCallback(
    (next: Lang) => {
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
      try {
        localStorage.setItem(LANG_COOKIE, next);
      } catch {
        // تجاهل — التخزين المحلي غير متاح في بعض السياقات.
      }
      setPicked(next);

      // تعتيم الصفحة لحظة التبديل ثم إعادة تصيير الخادم بأحدث كوكي.
      setSwitching(true);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      router.refresh();
      blurTimerRef.current = setTimeout(() => setSwitching(false), SWITCH_BLUR_MS);
    },
    [router]
  );

  const t = useCallback(
    (entry: MaybeEntry | DictKey) => translate(entry, lang),
    [lang]
  );

  const tw = useCallback(
    (key: DictKey, params: Record<string, string | number>) => {
      let text = translate(key, lang);
      for (const [k, v] of Object.entries(params)) {
        text = text.replaceAll(`{${k}}`, String(v));
      }
      return text;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, tw }}>
      {children}
      {switching && <div className="lang-switch-overlay" aria-hidden="true" />}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n يجب استخدامه داخل LanguageProvider");
  }
  return ctx;
}