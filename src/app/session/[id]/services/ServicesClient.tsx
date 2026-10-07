"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { useLiveElapsed } from "@/hooks/useLiveElapsed";
import { useSessionWatcher } from "@/hooks/useSessionWatcher";
import { clearStoredActiveSessionId } from "@/lib/active-session";
import { formatThousands } from "@/lib/money";
import {
  MAX_FILE_BYTES,
  MAX_FILE_MB,
  ALLOWED_TYPES_UI,
} from "@/lib/upload-policy";
import {
  SUGAR_LEVELS,
  PRINT_TYPE_LABELS,
  PAPER_LABELS,
  PRINT_MODE_LABELS,
  ORIENTATION_LABELS,
  type OrderDetails,
  type PrintType,
  type PaperSize,
  type PrintMode,
  type PrintOrientation,
  type SugarLevel,
} from "@/lib/orders";

export type ServiceDto = {
  id: string;
  name: string;
  category: string | null;
  price: number;
};

type ServicesClientProps = {
  sessionId: string;
  services: ServiceDto[];
  checkInIso: string | null;
  serverNowIso: string;
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// عدّاد الجلسة المصغّر للهيدر — عرض فقط؛ العدّاد نفسه يرثه من
// الجذر (useLiveElapsed) ليبقى مراقب حالة الجلسة في مكان واحد.
function MiniTimer({ elapsedMs }: { elapsedMs: number }) {
  const { t } = useI18n();

  return (
    <span className="mini-timer" title={t("services.miniTooltip")}>
      <span className="mini-timer-value" dir="ltr">
        {formatElapsed(elapsedMs)}
      </span>
      <span className="mini-timer-label">{t("services.miniTitle")}</span>
    </span>
  );
}

// أيقونة لكل خدمة حسب التصنيف — بلاطة مصفّحة بلون الفئة (من لوحة الهوية).
function ServiceIcon({ category }: { category: string | null }) {
  const cat = category ?? "";

  let color: string;
  let glyph: ReactNode;

  if (cat.includes("طباعة")) {
    color = "var(--color-primary)";
    glyph = (
      <>
        <path d="M6 9V3h12v6" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v7H6z" />
      </>
    );
  } else if (cat.includes("مشروبات") || cat.includes("شاي") || cat.includes("قهوة") || cat.includes("عصير")) {
    color = "var(--color-maroon)";
    glyph = (
      <>
        <path d="M5 9h13v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z" />
        <path d="M18 11h1.5a2.5 2.5 0 0 1 0 5H16" />
        <path d="M8.5 2.5c0 .85-.85 1.27-.85 2.12" />
        <path d="M12.5 2.5c0 .85-.85 1.27-.85 2.12" />
      </>
    );
  } else {
    color = "var(--color-tan)";
    glyph = (
      <path d="M12 6.5v13" />
    );
  }

  return (
    <span
      className="service-icon-tile"
      style={{ "--svc-color": color } as CSSProperties}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {glyph}
      </svg>
    </span>
  );
}

function isTeaOrCoffee(service: ServiceDto): boolean {
  return service.name.includes("شاي") || service.name.includes("قهوة");
}

function isDrink(service: ServiceDto): boolean {
  return (service.category ?? "").includes("مشروبات");
}

export function ServicesClient({
  sessionId,
  services,
  checkInIso,
  serverNowIso,
}: ServicesClientProps) {
  const router = useRouter();
  const { t, tw } = useI18n();
  const { showToast } = useToast();

  // عدّاد واحد حيّ للجذر كله + مراقبة حالة الجلسة: إن أنهى المدير جلستنا
  // من أي مكان (الداشبورد، الخريطة، جدول الجلسات) ننتقل فوراً إلى واجهة
  // "شكراً لزيارتك" — ولو كان نموذج طلب مفتوح في هذه اللحظة.
  const { elapsedMs, recalibrate } = useLiveElapsed(checkInIso, serverNowIso);
  useSessionWatcher({
    sessionId,
    onServerNow: recalibrate,
    onEnded: () => {
      router.replace(`/session/${sessionId}/ended`);
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, ServiceDto[]>();
    for (const service of services) {
      const key = service.category ?? "أخرى";
      const list = map.get(key) ?? [];
      list.push(service);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [services]);

  const [view, setView] = useState<"list" | "form" | "done">("list");
  const [selected, setSelected] = useState<ServiceDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // نموذج بسيط/مشروبات
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [sugar, setSugar] = useState<SugarLevel>("بدون سكر");

  // نموذج الطباعة
  const [printServices, setPrintServices] = useState<{
    bw: ServiceDto;
    color: ServiceDto;
  } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [printType, setPrintType] = useState<PrintType>("black_white");
  const [copies, setCopies] = useState("1");
  const [paper, setPaper] = useState<PaperSize>("a4");
  const [printMode, setPrintMode] = useState<PrintMode>("single_side");
  const [orientation, setOrientation] =
    useState<PrintOrientation>("portrait");

  function openForm(service: ServiceDto) {
    setSelected(service);
    setError(null);
    setQuantity("1");
    setNote("");
    setSugar("بدون سكر");
    setFile(null);
    setPrintType("black_white");
    setCopies("1");
    setPaper("a4");
    setPrintMode("single_side");
    setOrientation("portrait");
    setView("form");
  }

  // بطاقة "طباعة" واحدة: تحمل الخدمتين (أبيض/ملوّن) وتفتح نموذج الطباعة.
  function openPrint(printServicesPayload: { bw: ServiceDto; color: ServiceDto }) {
    setPrintServices(printServicesPayload);
    setSelected(printServicesPayload.bw);
    setError(null);
    setQuantity("1");
    setNote("");
    setFile(null);
    setPrintType("black_white");
    setCopies("1");
    setPaper("a4");
    setPrintMode("single_side");
    setOrientation("portrait");
    setView("form");
  }

  function backToList() {
    setView("list");
    setSelected(null);
    setPrintServices(null);
    setFile(null);
    setError(null);
  }

  function formatPrice(price: number): string {
    return price > 0 ? `${formatThousands(price)} ${t("services.currency")}` : "";
  }

  function validateFile(next: File | null): boolean {
    if (!next) return true;
    const dot = next.name.lastIndexOf(".");
    const ext = dot > 0 ? next.name.slice(dot + 1).toLowerCase() : "";
    const allowed = [
      "pdf", "jpg", "jpeg", "png",
      "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    ];
    if (!allowed.includes(ext)) {
      setError(tw("services.err.types", { types: ALLOWED_TYPES_UI }));
      return false;
    }
    if (next.size > MAX_FILE_BYTES) {
      setError(tw("services.err.size", { mb: MAX_FILE_MB }));
      return false;
    }
    return true;
  }

  async function submitPrint() {
    if (!printServices) return;

    if (!file) {
      setError(t("services.err.fileMissing"));
      return;
    }
    if (!validateFile(file)) return;

    const copiesNum = Number(copies);
    if (!Number.isInteger(copiesNum) || copiesNum <= 0 || copiesNum > 4) {
      setError(t("services.err.copies"));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("session_id", sessionId);
      formData.set("file", file);
      formData.set("print_type", printType);
      formData.set("copies", copies);
      formData.set("paper", paper);
      formData.set("print_mode", printMode);
      formData.set("orientation", orientation);
      if (note.trim() !== "") formData.set("note", note.trim());

      const res = await fetch("/api/orders/print", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.status === 409) {
        clearStoredActiveSessionId();
        router.replace(`/session/${sessionId}/ended`);
        return;
      }

      if (!res.ok || !data.ok) {
        setError(data.error ?? t("services.err.send"));
        showToast(data.error ?? t("services.err.send"), "error");
        return;
      }

      setView("done");
      showToast(t("services.ok.print"), "success");
    } catch {
      setError(t("services.err.network"));
      showToast(t("services.err.network"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSimple() {
    const service = selected;
    if (!service) return;

    const details: OrderDetails = {};

    const quantityNum = Number(quantity);
    if (!Number.isInteger(quantityNum) || quantityNum <= 0) {
      setError(t("services.err.quantity"));
      return;
    }
    details.quantity = quantityNum;

    // مشروبات تدعم السكر فقط (شاي/قهوة) — عصير بلا سكر.
    if (isTeaOrCoffee(service) && isDrink(service)) {
      details.sugar = sugar;
    }

    if (note.trim() !== "") {
      details.note = note.trim();
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          service_id: service.id,
          details,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        clearStoredActiveSessionId();
        router.replace(`/session/${sessionId}/ended`);
        return;
      }

      if (!res.ok || !data.ok) {
        setError(data.error ?? t("services.err.send"));
        showToast(data.error ?? t("services.err.send"), "error");
        return;
      }

      setView("done");
      showToast(t("services.ok.order"), "success");
    } catch {
      setError(t("services.err.network"));
      showToast(t("services.err.network"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  function submit() {
    if (printServices) {
      void submitPrint();
    } else {
      void submitSimple();
    }
  }

  const isPrintForm = printServices !== null;

  if (view === "done") {
    return (
      <main className="page">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/v4-outline.svg"
          alt="Focus Point"
          width={59}
          height={28}
          className="h-7 w-auto object-contain animate-fade-in-up"
        />
        <div className="card text-center animate-fade-in-up">
          <div
            className="pop-in mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: "linear-gradient(135deg, #593131 0%, #402127 100%)",
            }}
          >
            <span className="text-4xl leading-none text-surface">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
          </div>
          <h1 className="card-title">{t("services.done.title")}</h1>
          <p className="mb-6 text-sm text-muted">{t("services.done.sub")}</p>
          <div className="flex flex-col gap-3">
            <button type="button" className="btn btn-option" onClick={backToList}>
              {t("services.done.another")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => router.replace(`/session/${sessionId}`)}
            >
              {t("services.backToSession")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (view === "form" && selected) {
    return (
      <main
        className="page"
        style={{
          justifyContent: "flex-end",
          alignItems: "stretch",
          padding: 0,
          gap: 0,
          minHeight: "100dvh",
        }}
      >
        <form
          className="bottom-sheet w-full max-w-md mx-auto animate-fade-in-up"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <span className="bottom-sheet-handle" aria-hidden="true" />
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <span className="badge badge-neutral">
              {isPrintForm ? t("services.form.badgePrint") : t("services.form.badgeOrder")}
            </span>
            <h1 className="text-xl font-bold text-foreground">
              {isPrintForm ? t("services.form.titlePrint") : tw("services.form.orderPrint", { name: selected.name })}
            </h1>
            <p className="text-sm text-muted">
              {isPrintForm
                ? t("services.form.subPrint")
                : t("services.form.subOrder")}
            </p>
          </div>

          {error && <p className="error">{error}</p>}

          {isPrintForm ? (
            <>
              <div className="field">
                <label className="label" htmlFor="print-file">
                  {t("services.form.file")}
                </label>
                <input
                  id="print-file"
                  type="file"
                  className="input"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  onChange={(e) => {
                    const next = e.target.files?.[0] ?? null;
                    setError(null);
                    if (next && !validateFile(next)) {
                      e.target.value = "";
                      setFile(null);
                      return;
                    }
                    setFile(next);
                  }}
                />
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  {tw("services.form.fileHint", { types: ALLOWED_TYPES_UI, mb: MAX_FILE_MB })}
                </p>
                {file && (
                  <p className="mt-1.5 text-xs font-medium text-primary">
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div className="field">
                <label className="label" htmlFor="print-type">
                  {t("services.form.printType")}
                </label>
                <select
                  id="print-type"
                  className="input"
                  value={printType}
                  onChange={(e) => setPrintType(e.target.value as PrintType)}
                >
                  {(Object.keys(PRINT_TYPE_LABELS) as PrintType[]).map((k) => (
                    <option key={k} value={k}>
                      {k === "black_white" ? t("opt.bw") : t("opt.color")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="label" htmlFor="print-copies">
                  {t("services.form.copies")}
                </label>
                <input
                  id="print-copies"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={4}
                  required
                  className="input"
                  value={copies}
                  onChange={(e) => setCopies(e.target.value)}
                />
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  {t("services.form.copiesHint")}
                </p>
              </div>

              <div className="field">
                <label className="label" htmlFor="print-paper">
                  {t("services.form.paper")}
                </label>
                <select
                  id="print-paper"
                  className="input"
                  value={paper}
                  onChange={(e) => setPaper(e.target.value as PaperSize)}
                >
                  {(Object.keys(PAPER_LABELS) as PaperSize[]).map((k) => (
                    <option key={k} value={k}>
                      {k === "a4" ? t("opt.a4") : t("opt.booklet")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="label" htmlFor="print-mode">
                  {t("services.form.printMode")}
                </label>
                <select
                  id="print-mode"
                  className="input"
                  value={printMode}
                  onChange={(e) => setPrintMode(e.target.value as PrintMode)}
                >
                  {(Object.keys(PRINT_MODE_LABELS) as PrintMode[]).map((k) => (
                    <option key={k} value={k}>
                      {k === "single_side" ? t("opt.single") : t("opt.double")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="label" htmlFor="print-orientation">
                  {t("services.form.orientation")}
                </label>
                <select
                  id="print-orientation"
                  className="input"
                  value={orientation}
                  onChange={(e) =>
                    setOrientation(e.target.value as PrintOrientation)
                  }
                >
                  {(Object.keys(ORIENTATION_LABELS) as PrintOrientation[]).map(
                    (k) => (
                      <option key={k} value={k}>
                        {k === "portrait" ? t("opt.portrait") : t("opt.landscape")}
                      </option>
                    )
                  )}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label className="label" htmlFor="quantity">
                  {t("services.form.quantity")}
                </label>
                <input
                  id="quantity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  required
                  className="input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              {isDrink(selected) && isTeaOrCoffee(selected) && (
                <div className="field">
                  <label className="label" htmlFor="sugar">
                    {t("services.form.sugar")}
                  </label>
                  <select
                    id="sugar"
                    className="input"
                    value={sugar}
                    onChange={(e) => setSugar(e.target.value as SugarLevel)}
                  >
                    {SUGAR_LEVELS.map((s) => (
                      <option key={s} value={s}>
                        {s === "بدون سكر"
                          ? t("sugar.none")
                          : s === "سكر خفيف"
                            ? t("sugar.light")
                            : s === "سكر متوسط"
                              ? t("sugar.medium")
                              : t("sugar.max")}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="field">
            <label className="label" htmlFor="note">
              {t("services.form.note")}
            </label>
            <input
              id="note"
              type="text"
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isPrintForm ? t("services.form.placeholderPrint") : t("services.form.placeholderOrder")}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={submitting}
            >
              {submitting ? t("services.form.submitting") : t("services.form.submit")}
            </button>
            <button
              type="button"
              className="btn btn-option btn-compact"
              onClick={backToList}
              disabled={submitting}
            >
              {t("services.form.cancel")}
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="w-full max-w-md animate-fade-in-up">
        {/* هيدر sticky: الشعار + عداد مصغّر */}
        <div className="services-bar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/v4-outline.svg"
            alt="Focus Point"
            className="services-bar-logo"
            width={59}
            height={28}
          />
          <MiniTimer elapsedMs={elapsedMs} />
        </div>

        <div className="services-hero">
          <span className="badge badge-neutral">{t("services.badge")}</span>
          <h1 className="services-hero-title">{t("services.title")}</h1>
          <p className="services-hero-sub">
            {t("services.sub")}
          </p>
        </div>

        <div className="focus-divider" aria-hidden="true">
          <span className="focus-divider-dot" />
        </div>

        {error && <p className="error">{error}</p>}

        {groups.map(([category, list]) => (
          <section key={category} className="mb-7 last:mb-0">
            <h2 className="service-section-heading">
              <span className="service-section-name">
                {category.includes("طباعة")
                  ? t("cat.print")
                  : category.includes("مشروبات")
                    ? t("cat.drinks")
                    : t("cat.other")}
              </span>
              <span className="service-section-count">{list.length}</span>
              <span className="h-px flex-1 bg-border" aria-hidden="true" />
            </h2>
            <div className="services-grid">
              {category.includes("طباعة") ? (
                <PrintServiceCard
                  services={list}
                  onOpen={(payload) => openPrint(payload)}
                  formatPrice={formatPrice}
                />
              ) : (
                list.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    className="service-card"
                    onClick={() => openForm(service)}
                  >
                    <ServiceIcon category={service.category} />
                    <span className="service-card-name">{service.name}</span>
                    {service.price > 0 && (
                      <span className="service-card-price">
                        {formatPrice(service.price)}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </section>
        ))}

        <button
          type="button"
          className="btn btn-option mt-8 w-full"
          onClick={() => router.replace(`/session/${sessionId}`)}
        >
          {t("services.backToSession")}
        </button>
      </div>
    </main>
  );
}

// بطاقة طباعة موحدة: دمج سعرَي أبيض/ملوّن في بطاقة واحدة.
function PrintServiceCard({
  services,
  onOpen,
  formatPrice,
}: {
  services: ServiceDto[];
  onOpen: (payload: { bw: ServiceDto; color: ServiceDto }) => void;
  formatPrice: (price: number) => string;
}) {
  const { t } = useI18n();
  const bw = services.find((s) => s.name.includes("أبيض")) ?? services[0];
  const color = services.find((s) => s.name.includes("ملونة")) ?? services[0] ?? bw;

  return (
    <button
      type="button"
      className="service-card"
      onClick={() => onOpen({ bw, color })}
    >
      <ServiceIcon category="طباعة" />
      <span className="service-card-name">{t("services.printCard")}</span>
      {bw.price > 0 && (
        <span className="service-card-price">
          {formatPrice(bw.price)} {t("services.priceBwSuffix")}
        </span>
      )}
    </button>
  );
}