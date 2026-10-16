"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePolling } from "@/lib/admin-hooks";
import { POLL_STANDARD_MS } from "@/lib/admin-poll";
import { useToast } from "@/components/Toast";
import { SkeletonLines } from "@/components/SkeletonLines";
import { EmptyState } from "@/components/EmptyState";
import { CloseButton } from "@/components/CloseButton";
import { formatThousands } from "@/lib/money";

type TrainingCourse = {
  id: string;
  name: string;
  code: string;
  trainer: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  days: string[];
  studentsCount: number;
  sessionsCount: number;
  totalCost: number;
  costPerStudent: number;
  centerSharePercent: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  name: string;
  code: string;
  trainer: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  days: string[];
  studentsCount: string;
  sessionsCount: string;
  totalCost: string;
  costPerStudent: string;
  centerSharePercent: string;
  notes: string;
};

type StatusKey = "upcoming" | "ongoing" | "ended";

const emptyForm: FormState = {
  name: "",
  code: "",
  trainer: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  days: [],
  studentsCount: "",
  sessionsCount: "",
  totalCost: "",
  costPerStudent: "",
  centerSharePercent: "",
  notes: "",
};

const DAY_OPTS = [
  { key: "sat", ar: "السبت" },
  { key: "sun", ar: "الأحد" },
  { key: "mon", ar: "الاثنين" },
  { key: "tue", ar: "الثلاثاء" },
  { key: "wed", ar: "الأربعاء" },
  { key: "thu", ar: "الخميس" },
  { key: "fri", ar: "الجمعة" },
];

const DAY_LABEL: Record<string, string> = Object.fromEntries(
  DAY_OPTS.map((d) => [d.key, d.ar] as const)
);

const STATUS_META: Record<StatusKey, { ar: string; cls: string }> = {
  upcoming: { ar: "قادمة", cls: "badge-pending" },
  ongoing: { ar: "جارية", cls: "badge-live" },
  ended: { ar: "منتهية", cls: "badge-neutral" },
};

const STATUS_TABS: { key: "all" | StatusKey; ar: string }[] = [
  { key: "all", ar: "الكل" },
  { key: "upcoming", ar: "قادمة" },
  { key: "ongoing", ar: "جارية" },
  { key: "ended", ar: "منتهية" },
];

function courseStatus(c: TrainingCourse): StatusKey {
  const today = new Date();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const s = new Date(c.startDate + "T00:00:00");
  const e = new Date(c.endDate + "T00:00:00");
  if (t < s) return "upcoming";
  if (t > e) return "ended";
  return "ongoing";
}

function daysText(days: string[]): string {
  return days.map((d) => DAY_LABEL[d] ?? d).join("، ");
}

function TrainingModal({
  title,
  subtitle,
  wide,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      className="session-panel-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`session-panel${wide ? " hosp-modal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="session-panel-head">
          <div className="session-panel-head-text">
            <h3 className="session-panel-name">{title}</h3>
            {subtitle && <p className="session-panel-sub">{subtitle}</p>}
          </div>
          <CloseButton
            className="session-panel-close"
            ariaLabel="إغلاق"
            onClose={onClose}
          />
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function TrainingManager() {
  const { showToast } = useToast();
  const [courses, setCourses] = useState<TrainingCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusKey>("all");
  const [trainerFilter, setTrainerFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/training", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setCourses(data.courses);
        setError(null);
      } else {
        setError(data.error ?? "تعذّر تحميل دورات قاعة التدريب");
        showToast(data.error ?? "تعذّر تحميل دورات قاعة التدريب", "error");
      }
    } catch {
      setError("فشل الاتصال بالشبكة");
      showToast("فشل الاتصال بالشبكة", "error");
    }
  }, [showToast]);

  usePolling(load, POLL_STANDARD_MS);

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setError(null);
    setFormOpen(true);
  }

  function startEdit(c: TrainingCourse) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      code: c.code,
      trainer: c.trainer,
      startDate: c.startDate,
      endDate: c.endDate,
      startTime: c.startTime,
      endTime: c.endTime,
      days: [...c.days],
      studentsCount: String(c.studentsCount),
      sessionsCount: String(c.sessionsCount),
      totalCost: String(c.totalCost),
      costPerStudent: String(c.costPerStudent),
      centerSharePercent: String(c.centerSharePercent),
      notes: c.notes,
    });
    setError(null);
    setFormOpen(true);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError(null);
  }

  function closeForm() {
    resetForm();
    setFormOpen(false);
  }

  function toggleDay(k: string) {
    setForm((f) => {
      const has = f.days.includes(k);
      return { ...f, days: has ? f.days.filter((d) => d !== k) : [...f.days, k] };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        trainer: form.trainer.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        startTime: form.startTime,
        endTime: form.endTime,
        days: form.days,
        studentsCount: Number(form.studentsCount),
        sessionsCount: Number(form.sessionsCount),
        totalCost: Number(form.totalCost),
        costPerStudent: Number(form.costPerStudent),
        centerSharePercent: Number(form.centerSharePercent),
        notes: form.notes.trim(),
      };
      const res = editingId
        ? await fetch(`/api/admin/training/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/training", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "فشل حفظ الدورة");
        showToast(data.error ?? "فشل حفظ الدورة", "error");
      } else {
        closeForm();
        await load();
        showToast(editingId ? "تم تعديل الدورة بنجاح" : "تم إضافة الدورة بنجاح", "success");
      }
    } catch {
      setError("فشل الاتصال بالشبكة");
      showToast("فشل الاتصال بالشبكة", "error");
    } finally {
      setBusy(false);
    }
  }

  async function doDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/training/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data.error ?? "فشل حذف الدورة", "error");
      } else {
        setConfirmDelete(null);
        await load();
        showToast("تم حذف الدورة بنجاح", "success");
      }
    } catch {
      showToast("فشل الاتصال بالشبكة", "error");
    }
  }

  const trainers = useMemo(() => {
    if (!courses) return [];
    const set = new Set<string>();
    for (const c of courses) if (c.trainer) set.add(c.trainer);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ar"));
  }, [courses]);

  const filtered = useMemo(() => {
    if (!courses) return [];
    let list = courses;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s));
    }
    if (trainerFilter !== "all") {
      list = list.filter((c) => c.trainer === trainerFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((c) => courseStatus(c) === statusFilter);
    }
    return list;
  }, [courses, search, trainerFilter, statusFilter]);

  const detail = detailId ? courses?.find((c) => c.id === detailId) : null;

  const header = (
    <div className="training-header">
      <div className="training-header-text">
        <h1 className="admin-section-title mb-0">قاعة التدريب</h1>
        <p className="text-sm text-muted">
          دورات قاعة التدريب — إدخال يدوي وتخزين وعرض فقط.
        </p>
      </div>
      <button
        type="button"
        className="btn btn-primary rounded-lg px-5 py-2.5 text-sm"
        onClick={openCreate}
      >
        + إضافة دورة
      </button>
    </div>
  );

  if (courses === null) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        {error ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            {error}
            <button
              type="button"
              className="btn btn-option mt-3 rounded-lg px-3 py-1.5 text-sm"
              onClick={() => void load()}
            >
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <SkeletonLines rows={5} />
        )}
      </div>
    );
  }

  const totalCost = courses.reduce((s, c) => s + Number(c.totalCost), 0);
  const centerShare = courses.reduce((s, c) => s + (Number(c.totalCost) * Number(c.centerSharePercent)) / 100, 0);
  const totalStudents = courses.reduce((s, c) => s + Number(c.studentsCount), 0);

  return (
    <div className="flex flex-col gap-6">
      {header}

      {courses.length > 0 && (
        <>
          {/* إحصاءات الدورات */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <section className="stat-card">
              <h2 className="stat-label">عدد الدورات</h2>
              <p className="stat-value text-2xl tabular-nums">{courses.length}</p>
            </section>

            <section className="stat-card">
              <h2 className="stat-label">إجمالي الطلاب</h2>
              <p className="stat-value text-2xl tabular-nums">{totalStudents}</p>
            </section>

            <section className="stat-card">
              <h2 className="stat-label">إجمالي التكلفة الكاملة</h2>
              <p className="stat-value text-2xl tabular-nums">
                {formatThousands(totalCost)}{" "}
                <span className="text-sm font-medium text-muted">ل.س</span>
              </p>
            </section>

            <section
              className="stat-card"
              style={{ borderInlineStart: "4px solid var(--color-primary)" }}
            >
              <h2 className="stat-label">حصة المركز</h2>
              <p className="stat-value text-2xl tabular-nums text-primary">
                {formatThousands(centerShare)}{" "}
                <span className="text-sm font-medium">ل.س</span>
              </p>
            </section>
          </div>

          {/* شريط الفلترة */}
          <div className="training-toolbar">
            <input
              type="text"
              className="input training-search"
              placeholder="بحث بالاسم أو الرمز"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="input training-select"
              value={trainerFilter}
              onChange={(e) => setTrainerFilter(e.target.value)}
              aria-label="تصفية حسب المدرب"
            >
              <option value="all">كل المدربين</option>
              {trainers.map((tr) => (
                <option key={tr} value={tr}>{tr}</option>
              ))}
            </select>
            <div className="training-seg" role="group" aria-label="تصفية حسب الحالة">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`training-seg-btn${statusFilter === tab.key ? " is-active" : ""}`}
                  onClick={() => setStatusFilter(tab.key)}
                >
                  {tab.ar}
                </button>
              ))}
            </div>
          </div>

          <div className="training-list-head">
            <span className="training-count">{filtered.length} دورة</span>
            <span className="training-note">غير محتسبة ضمن إيرادات الجلسات</span>
          </div>
        </>
      )}

      {/* بطاقات الدورات */}
      {courses.length === 0 ? (
        <EmptyState
          title="لا توجد دورات بعد"
          hint="ابدأ بإضافة أول دورة إلى قاعة التدريب."
          action={
            <button
              type="button"
              className="btn btn-primary rounded-lg px-5 py-2.5 text-sm"
              onClick={openCreate}
            >
              + إضافة دورة
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="لا توجد نتائج مطابقة" hint="جرّب تعديل البحث أو الفلاتر." />
      ) : (
        <div className="training-grid">
          {filtered.map((c) => {
            const meta = STATUS_META[courseStatus(c)];
            return (
              <article key={c.id} className="training-card">
                <div className="training-card-head">
                  <div className="training-card-heading">
                    <h3 className="training-card-name">{c.name}</h3>
                    <p className="training-card-trainer">المدرب: {c.trainer || "—"}</p>
                  </div>
                  <span className={`badge ${meta.cls}`}>{meta.ar}</span>
                </div>

                <div className="training-card-chips">
                  <span className="training-code" dir="ltr">{c.code}</span>
                  {c.days.map((d) => (
                    <span key={d} className="training-day-chip">{DAY_LABEL[d] ?? d}</span>
                  ))}
                </div>

                <dl className="training-info">
                  <div className="training-info-item full">
                    <dt>الفترة</dt>
                    <dd className="tabular-nums" dir="ltr">{c.startDate} → {c.endDate}</dd>
                  </div>
                  <div className="training-info-item">
                    <dt>الوقت</dt>
                    <dd className="tabular-nums" dir="ltr">{c.startTime} - {c.endTime}</dd>
                  </div>
                  <div className="training-info-item">
                    <dt>نسبة المركز</dt>
                    <dd className="tabular-nums">{c.centerSharePercent}%</dd>
                  </div>
                </dl>

                <div className="training-stats">
                  <div className="training-stat">
                    <span className="training-stat-num">{c.studentsCount}</span>
                    <span className="training-stat-lbl">طالب</span>
                  </div>
                  <div className="training-stat">
                    <span className="training-stat-num">{c.sessionsCount}</span>
                    <span className="training-stat-lbl">جلسة</span>
                  </div>
                  <div className="training-stat">
                    <span className="training-stat-num money" dir="ltr">{formatThousands(c.totalCost)}</span>
                    <span className="training-stat-lbl">التكلفة الكاملة (ل.س)</span>
                  </div>
                  <div className="training-stat">
                    <span className="training-stat-num money" dir="ltr">{formatThousands(c.costPerStudent)}</span>
                    <span className="training-stat-lbl">لشخص (ل.س)</span>
                  </div>
                </div>

                <div className="training-card-foot">
                  <button
                    type="button"
                    className="btn btn-option rounded-lg px-3 py-1.5 text-xs"
                    onClick={() => setDetailId(c.id)}
                  >
                    تفاصيل
                  </button>
                  <button
                    type="button"
                    className="btn btn-option rounded-lg px-3 py-1.5 text-xs"
                    onClick={() => startEdit(c)}
                  >
                    تعديل
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger rounded-lg px-3 py-1.5 text-xs"
                    onClick={() => setConfirmDelete(c.id)}
                  >
                    حذف
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* نافذة الإضافة/التعديل */}
      {formOpen && (
        <TrainingModal
          wide
          title={editingId ? "تعديل دورة" : "إضافة دورة جديدة"}
          subtitle="إدخال يدوي — تُحفظ القيم كما تُدخل بالضبط"
          onClose={closeForm}
        >
          {error && <p className="error">{error}</p>}
          <form onSubmit={submit} className="flex flex-col">
            <div className="field">
              <label className="label" htmlFor="t-name">اسم الدورة</label>
              <input id="t-name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="t-code">رمز الدورة (فريد)</label>
                <input id="t-code" className="input" dir="ltr" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="t-trainer">اسم المدرب</label>
                <input id="t-trainer" className="input" required value={form.trainer} onChange={(e) => setForm({ ...form, trainer: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="t-start">تاريخ البدء</label>
                <input id="t-start" type="date" className="input" dir="ltr" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="t-end">تاريخ النهاية</label>
                <input id="t-end" type="date" className="input" dir="ltr" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="t-st">وقت البدء</label>
                <input id="t-st" type="time" className="input" dir="ltr" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="t-et">وقت النهاية</label>
                <input id="t-et" type="time" className="input" dir="ltr" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>

            <div className="field">
              <span className="label">أيام الجلسات</span>
              <div className="end-chip-row" role="group" aria-label="أيام الجلسات">
                {DAY_OPTS.map((d) => {
                  const active = form.days.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      className={`btn btn-option rounded-lg${active ? " is-active" : ""}`}
                      onClick={() => toggleDay(d.key)}
                    >
                      {d.ar}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="t-stc">عدد الطلاب</label>
                <input id="t-stc" type="number" min={0} step={1} className="input" dir="ltr" required value={form.studentsCount} onChange={(e) => setForm({ ...form, studentsCount: e.target.value })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="t-snc">عدد جلسات الدورة</label>
                <input id="t-snc" type="number" min={0} step={1} className="input" dir="ltr" required value={form.sessionsCount} onChange={(e) => setForm({ ...form, sessionsCount: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="t-tc">التكلفة الكاملة</label>
                <input id="t-tc" type="number" min={0} step="0.01" className="input" dir="ltr" required value={form.totalCost} onChange={(e) => setForm({ ...form, totalCost: e.target.value })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="t-cps">التكلفة للشخص</label>
                <input id="t-cps" type="number" min={0} step="0.01" className="input" dir="ltr" required value={form.costPerStudent} onChange={(e) => setForm({ ...form, costPerStudent: e.target.value })} />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="t-share">نسبة المركز (0–100)</label>
              <input id="t-share" type="number" min={0} max={100} step="0.01" className="input" dir="ltr" required value={form.centerSharePercent} onChange={(e) => setForm({ ...form, centerSharePercent: e.target.value })} />
            </div>

            <div className="field">
              <label className="label" htmlFor="t-notes">ملاحظات (اختياري)</label>
              <textarea id="t-notes" className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="session-panel-actions end-actions">
              <button
                type="button"
                className="btn btn-ghost rounded-lg px-4 py-2 text-sm"
                onClick={closeForm}
                disabled={busy}
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="btn btn-primary rounded-lg px-5 py-2 text-sm"
                disabled={busy}
              >
                {busy ? "جارٍ الحفظ…" : editingId ? "حفظ التعديلات" : "إضافة دورة"}
              </button>
            </div>
          </form>
        </TrainingModal>
      )}

      {/* نافذة التفاصيل */}
      {detail && (
        <TrainingModal
          title={detail.name}
          subtitle={`الرمز ${detail.code}`}
          onClose={() => setDetailId(null)}
        >
          <dl className="session-facts">
            <div className="session-fact"><dt>المدرب</dt><dd>{detail.trainer || "—"}</dd></div>
            <div className="session-fact"><dt>الفترة</dt><dd className="tabular-nums" dir="ltr">{detail.startDate} → {detail.endDate}</dd></div>
            <div className="session-fact"><dt>الوقت</dt><dd className="tabular-nums" dir="ltr">{detail.startTime} - {detail.endTime}</dd></div>
            <div className="session-fact"><dt>الأيام</dt><dd>{daysText(detail.days)}</dd></div>
            <div className="session-fact"><dt>عدد الطلاب</dt><dd className="tabular-nums">{detail.studentsCount}</dd></div>
            <div className="session-fact"><dt>عدد الجلسات</dt><dd className="tabular-nums">{detail.sessionsCount}</dd></div>
            <div className="session-fact"><dt>التكلفة الكاملة</dt><dd className="tabular-nums" dir="ltr">{formatThousands(detail.totalCost)} ل.س</dd></div>
            <div className="session-fact"><dt>التكلفة للشخص</dt><dd className="tabular-nums" dir="ltr">{formatThousands(detail.costPerStudent)} ل.س</dd></div>
            <div className="session-fact"><dt>نسبة المركز</dt><dd className="tabular-nums">{detail.centerSharePercent}%</dd></div>
            {detail.notes && (
              <div className="session-fact"><dt>ملاحظات</dt><dd>{detail.notes}</dd></div>
            )}
          </dl>
          <div className="session-panel-actions end-actions">
            <button
              type="button"
              className="btn btn-ghost rounded-lg px-4 py-2 text-sm"
              onClick={() => setDetailId(null)}
            >
              إغلاق
            </button>
            <button
              type="button"
              className="btn btn-option rounded-lg px-4 py-2 text-sm"
              onClick={() => {
                const c = detail;
                setDetailId(null);
                if (c) startEdit(c);
              }}
            >
              تعديل
            </button>
          </div>
        </TrainingModal>
      )}

      {/* تأكيد الحذف */}
      {confirmDelete && (
        <TrainingModal
          title="تأكيد حذف الدورة"
          onClose={() => setConfirmDelete(null)}
        >
          <p className="text-sm text-foreground">
            سيتم حذف الدورة نهائياً. لا يمكن التراجع عن هذا الإجراء.
          </p>
          <div className="session-panel-actions end-actions">
            <button
              type="button"
              className="btn btn-ghost rounded-lg px-4 py-2 text-sm"
              onClick={() => setConfirmDelete(null)}
            >
              إلغاء
            </button>
            <button
              type="button"
              className="btn btn-danger rounded-lg px-5 py-2 text-sm"
              onClick={() => void doDelete(confirmDelete)}
            >
              تأكيد الحذف
            </button>
          </div>
        </TrainingModal>
      )}
    </div>
  );
}
