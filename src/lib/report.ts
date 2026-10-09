// ============================================================
// التقارير اليومية — سجل الخدمات لكل طالب + تصدير Excel منسق
// ------------------------------------------------------------
// لقطة للقراءة فقط (SELECT) من قاعدة البيانات المحلية — البيانات
// تبقى محفوظة في القاعدة الأصلية، والتقرير نسخة قابلة للمسك:
//   - مَن زارنا (الطلاب والجلسات)
//   - ما الطلبات التي قدّمها كل طالب على حدة
//   - إيرادات اليوم والمبيعات بالمجمل وتفصيلاً لكل خدمة
// ============================================================

import { prisma } from "@/lib/prisma";
import {
  PRINT_TYPE_LABELS,
  PAPER_LABELS,
  PRINT_MODE_LABELS,
  ORIENTATION_LABELS,
  orderTotal,
  orderUnits,
  type OrderDetails,
} from "@/lib/orders";
import ExcelJS from "exceljs";
import { computeBilling } from "@/lib/billing";
import { readHourlyRate } from "@/lib/settings";

const TZ = "Asia/Damascus";

/** تاريخ اليوم بصيغة YYYY-MM-DD بمنطقة دمشق. */
export function damascusToday(): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(new Date());
}

/** إزاحة المنطقة (بالميللي ثانية) بين UTC ودمشق عند لحظة معينة. */
function tzOffsetAt(atMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(atMs)) parts[p.type] = p.value;
  const asUtc = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second
  );
  return asUtc - atMs;
}

/** بداية "Y-m-d 00:00" وبداية اليوم التالي كطوابع UTC مطلقة. */
export function damascusDayBoundaries(from: string, to: string) {
  // ملاحظة: شهور Date.UTC تبدأ من صفر؛ نطرح 1 من الشهر دائماً وإلا
  // انزاحت نهاية الفترة شهراً كاملاً للأمام (2026-10 → 2026-11).
  const [toY, toM, toD] = to.split("-").map(Number);
  const toNext = new Date(Date.UTC(toY, toM - 1, toD, 0));
  toNext.setUTCDate(toNext.getUTCDate() + 1);
  const toStr = toNext.toISOString().slice(0, 10);

  const out = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const offset = tzOffsetAt(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Date(Date.UTC(y, m - 1, d) - offset);
  };
  return { fromDate: out(from), toDate: out(toStr) };
}

// ============================================================
// البيانات
// ============================================================

export type ReportOrder = {
  order_id: string;
  created_at: string;
  status: string;
  /** سعر الوحدة كما هو في جدول الخدمات. */
  price: number;
  /** عدد الوحدات (كمية المشروبات أو نسخ الطباعة). */
  units: number;
  /** إجمالي الطلب = سعر الوحدة × الوحدات. */
  total_price: number;
  service_name: string;
  service_category: string | null;
  student_id: string;
  student_name: string;
  student_phone: string | null;
  room: string | null;
  group_label: string | null;
  seat_number: number | null;
  details_label: string;
};

export type ReportSession = {
  session_id: string;
  student_id: string;
  student_name: string;
  student_phone: string | null;
  room: string | null;
  group_label: string | null;
  seat_number: number | null;
  check_in: string;
  check_out: string | null;
  duration_sec: number;
  status: string;
  /** الساعات المحتسبة للجلسة (للجلسات النشطة تُحسب الآن تقديرياً). */
  billable_hours: number;
  /** مبلغ الجلسة = ساعات × سعر الساعة (لقطة أو حساب الآن) — قبل الخصم. */
  session_amount: number;
  /** مجموع الخدمات المنفذة (done) في الجلسة. */
  services_total: number;
  /** المبلغ الكلي قبل الخصم = مبلغ الجلسة + الخدمات. */
  total: number;
  /** الخصم المطبّق عند الإنهاء (0 = بلا خصم). */
  discount_amount: number;
  discount_scope: string | null;
  discount_type: string | null;
  discount_value: number | null;
  discount_note: string | null;
  /** المبلغ بعد الخصم — final_amount المحفوظ إن وُجد وإلا الكلي. */
  final_total: number;
};

export type ReportStudent = {
  student_id: string;
  name: string;
  phone: string | null;
  sessions_count: number;
  orders_count: number;
  done_amount: number;
};

export type ReportService = {
  name: string;
  count: number;
  done_count: number;
  done_total: number;
};

/**
 * سجل ضيافة ضمن الفترة — إحصاء تقديري فقط (لا يدخل بالإيرادات).
 * القيمة التقديرية = لقطة سعر الخدمة وقت التسجيل × الكمية.
 */
export type ReportHospitality = {
  log_id: string;
  created_at: string;
  recipient_type: "guest" | "management";
  recipient_label: string;
  guests_count: number;
  quantity: number;
  unit_price: number;
  estimated_value: number;
  service_name: string;
  service_category: string | null;
  note: string | null;
};

export type ReportData = {
  from: string;
  to: string;
  generated_at: string;
  summary: {
    students_count: number;
    sessions_count: number;
    orders_count: number;
    done_count: number;
    pending_count: number;
    cancelled_count: number;
    done_revenue: number;
    /** رسوم الجلسات المنتهية (قبل الخصم). */
    sessions_revenue: number;
    /** إجمالي الخصومات الممنوحة في الفترة (للسجلات المنتهية). */
    discounts_total: number;
    /**
     * إيرادات الفترة الموحّد بعد الخصم:
     * done_revenue + sessions_revenue − discounts_total.
     * (يتطابق هيكرياً مع final_amount لكل جلسة.)
     */
    revenue: number;
    ended_sessions: number;
    billable_hours: number;
    avg_billable_hours: number;
    hours_by_room: { social: number; silent: number; smoking: number };
  };
  students: ReportStudent[];
  orders: ReportOrder[];
  sessions: ReportSession[];
  services: ReportService[];
  /** سجل الضيافة للفترة — تقديري، خارج حساب الإيرادات. */
  hospitality: ReportHospitality[];
};

/** وصف نصي مُختصر لتفاصيل الطلب (للأعمدة والعرض). */
function detailsLabel(raw: OrderDetails | null): string {
  const d = raw ?? {};
  const parts: string[] = [];

  if (typeof d.print_type === "string") {
    parts.push(
      `طباعة: ${PRINT_TYPE_LABELS[d.print_type] ?? d.print_type}`
    );
  }
  if (typeof d.copies === "number") parts.push(`${d.copies} نسخ`);
  if (d.paper) parts.push(PAPER_LABELS[d.paper] ?? d.paper);
  if (d.print_mode) parts.push(PRINT_MODE_LABELS[d.print_mode] ?? d.print_mode);
  if (d.orientation)
    parts.push(ORIENTATION_LABELS[d.orientation] ?? d.orientation);
  if (d.file_name) parts.push(`ملف: ${d.file_name}`);
  // للطباعة المستمرة عبر `copies`؛ نتجنب تكرار "2 نسخ" عند وجود quantity أيضاً.
  if (typeof d.quantity === "number" && typeof d.copies !== "number")
    parts.push(`كمية: ${d.quantity}`);
  if (d.sugar) parts.push(`سكر: ${d.sugar}`);
  if (d.note) parts.push(`ملاحظة: ${d.note}`);

  return parts.join(" • ");
}

function priceOf(order: {
  status: string;
  total_price: number;
}): number {
  return order.status === "done" ? order.total_price : 0;
}

/** تقريب لمنزلتين (مبالغ بالليرة). */
function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** جلب بيانات الفترة من قاعدة البيانات (قراءة فقط). */
export async function fetchReport(
  fromDate: Date,
  toDate: Date,
  from: string,
  to: string
): Promise<ReportData> {
  const hourlyRate = await readHourlyRate(prisma);
  const [sessions, orders, hospitalityLogs] = await Promise.all([
    prisma.session.findMany({
      where: { checkIn: { gte: fromDate, lt: toDate } },
      include: {
        student: { select: { id: true, name: true, phone: true } },
        spot: { select: { room: true, groupLabel: true, seatNumber: true } },
        orders: {
          where: { status: "done" },
          select: { details: true, service: { select: { price: true } } },
        },
      },
      orderBy: { checkIn: "asc" },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: fromDate, lt: toDate } },
      include: {
        service: { select: { name: true, category: true, price: true } },
        session: {
          include: {
            student: { select: { id: true, name: true, phone: true } },
            spot: { select: { room: true, groupLabel: true, seatNumber: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.hospitalityLog.findMany({
      where: { createdAt: { gte: fromDate, lt: toDate } },
      include: {
        service: { select: { name: true, category: true } },
        recipient: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const hospitality: ReportHospitality[] = hospitalityLogs.map((l) => ({
    log_id: l.id,
    created_at: l.createdAt.toISOString(),
    recipient_type: l.recipientType === "management" ? "management" : "guest",
    recipient_label:
      l.recipient?.name ?? l.guestLabel ?? "—",
    guests_count: l.guestsCount,
    quantity: l.quantity,
    unit_price: r2(Number(l.unitPriceSnapshot)),
    estimated_value: r2(Number(l.unitPriceSnapshot) * l.quantity),
    service_name: l.service.name,
    service_category: l.service.category,
    note: l.note,
  }));

  const reportOrders: ReportOrder[] = orders.map((o) => {
    const details = (o.details as OrderDetails | null) ?? null;
    const unitPrice = Number(o.service.price);
    return {
      order_id: o.id,
      created_at: o.createdAt.toISOString(),
      status: o.status,
      price: unitPrice,
      units: orderUnits(details),
      total_price: orderTotal(unitPrice, details),
      service_name: o.service.name,
      service_category: o.service.category,
      student_id: o.session.student.id,
      student_name: o.session.student.name,
      student_phone: o.session.student.phone,
      room: o.session.spot?.room ?? null,
      group_label: o.session.spot?.groupLabel ?? null,
      seat_number: o.session.spot?.seatNumber ?? null,
      details_label: detailsLabel(details),
    };
  });

  const reportSessions: ReportSession[] = sessions.map((s) => {
    const checkOut = s.checkOut?.getTime() ?? Date.now();
    const checkOutDate = new Date(checkOut);

    // لقطة الفوترة إن وُجدت، وإن لم تكن (جلسة منتهية قبل الميزة أو نشطة
    // الآن) نحسبها تقديرياً وفق نفس قاعدة computeBilling.
    let billableHours = s.billableHours;
    let sessionAmount = s.sessionAmount ? Number(s.sessionAmount) : null;
    if (billableHours == null || sessionAmount == null) {
      const billing = computeBilling(s.checkIn, checkOutDate, hourlyRate);
      billableHours = billing.billableHours;
      sessionAmount = billing.amount;
    }

    const servicesTotal = s.orders.reduce(
      (sum, o) => sum + orderTotal(Number(o.service.price), o.details as OrderDetails | null),
      0
    );

    const grossTotal = r2(sessionAmount + servicesTotal);
    const discountAmount = s.discountAmount ? Number(s.discountAmount) : 0;
    const finalTotal = s.finalAmount
      ? Number(s.finalAmount)
      : r2(grossTotal - discountAmount);

    return {
      session_id: s.id,
      student_id: s.student.id,
      student_name: s.student.name,
      student_phone: s.student.phone,
      room: s.spot?.room ?? null,
      group_label: s.spot?.groupLabel ?? null,
      seat_number: s.spot?.seatNumber ?? null,
      check_in: s.checkIn.toISOString(),
      check_out: s.checkOut?.toISOString() ?? null,
      duration_sec: Math.max(
        0,
        Math.round((checkOut - s.checkIn.getTime()) / 1000)
      ),
      status: s.status,
      billable_hours: billableHours,
      session_amount: sessionAmount,
      services_total: servicesTotal,
      total: grossTotal,
      discount_amount: discountAmount,
      discount_scope: s.discountScope,
      discount_type: s.discountType,
      discount_value: s.discountValue ? Number(s.discountValue) : null,
      discount_note: s.discountNote,
      final_total: finalTotal,
    };
  });

  // طلاب الفترة: من الجلسات والطلبات معاً.
  const studentMap = new Map<
    string,
    { id: string; name: string; phone: string | null }
  >();
  for (const s of sessions)
    studentMap.set(s.student.id, {
      id: s.student.id,
      name: s.student.name,
      phone: s.student.phone,
    });
  for (const o of orders)
    studentMap.set(o.session.student.id, {
      id: o.session.student.id,
      name: o.session.student.name,
      phone: o.session.student.phone,
    });

  const students: ReportStudent[] = [...studentMap.values()].map((st) => {
    const myOrders = reportOrders.filter((o) => o.student_id === st.id);
    return {
      student_id: st.id,
      name: st.name,
      phone: st.phone,
      sessions_count: reportSessions.filter(
        (s) => s.student_id === st.id
      ).length,
      orders_count: myOrders.length,
      done_amount: myOrders.reduce((sum, o) => sum + priceOf(o), 0),
    };
  });

  // تلخيص الخدمات.
  const serviceMap = new Map<string, ReportService>();
  for (const o of reportOrders) {
    const key = o.service_name;
    const agg = serviceMap.get(key) ?? {
      name: key,
      count: 0,
      done_count: 0,
      done_total: 0,
    };
    agg.count += 1;
    if (o.status === "done") {
      agg.done_count += 1;
      agg.done_total += o.total_price;
    }
    serviceMap.set(key, agg);
  }

  // إجماليات الساعات للجلسات المنتهية فقط (المبالغ المسوّاة فعلياً).
  const endedSessions = reportSessions.filter((s) => s.status === "ended");
  const billableHoursTotal = endedSessions.reduce(
    (sum, s) => sum + s.billable_hours,
    0
  );
  const hoursByRoom = (room: string) =>
    endedSessions.reduce(
      (sum, s) => sum + (s.room === room ? s.billable_hours : 0),
      0
    );

  const doneRevenue = reportOrders.reduce((sum, o) => sum + priceOf(o), 0);
  const sessionsRevenue = endedSessions.reduce(
    (sum, s) => sum + s.session_amount,
    0
  );
  const discountsTotal = endedSessions.reduce(
    (sum, s) => sum + s.discount_amount,
    0
  );

  const summary: ReportData["summary"] = {
    students_count: students.length,
    sessions_count: reportSessions.length,
    orders_count: reportOrders.length,
    done_count: reportOrders.filter((o) => o.status === "done").length,
    pending_count: reportOrders.filter((o) => o.status === "pending").length,
    cancelled_count: reportOrders.filter((o) => o.status === "cancelled").length,
    done_revenue: doneRevenue,
    sessions_revenue: r2(sessionsRevenue),
    discounts_total: r2(discountsTotal),
    revenue: r2(doneRevenue + sessionsRevenue - discountsTotal),
    ended_sessions: endedSessions.length,
    billable_hours: billableHoursTotal,
    avg_billable_hours:
      endedSessions.length > 0 ? billableHoursTotal / endedSessions.length : 0,
    hours_by_room: {
      social: hoursByRoom("social"),
      silent: hoursByRoom("silent"),
      smoking: hoursByRoom("smoking"),
    },
  };

  return {
    from,
    to,
    generated_at: new Date().toISOString(),
    summary,
    students: students.sort((a, b) => a.name.localeCompare(b.name, "ar")),
    orders: reportOrders,
    sessions: reportSessions,
    services: [...serviceMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "ar")
    ),
    hospitality,
  };
}

// ============================================================
// بناء مصنف Excel منسق
// ============================================================

// ألوان الهوية (القيم من FOCUS_POINT.md).
const C_PRIMARY = "FF402127";
const C_MAROON = "FF593131";
const C_BORDER = "FFE5DCD2";
const C_BG = "FFFBF8F5";
const C_TEXT = "FF2C1B1D";
const C_MUTED = "FF735840";
const C_SURFACE = "FFFFFFFF";
const C_SUCCESS = "FF4A6B4E";

function colWidths(widths: number[]) {
  return widths.map((w) => ({ width: w }));
}

function headerRow(
  ws: ExcelJS.Worksheet,
  cells: string[],
  rowIndex: number
): ExcelJS.Row {
  const row = ws.getRow(rowIndex);
  cells.forEach((c, i) => {
    const cell = row.getCell(i + 1);
    cell.value = c;
    cell.font = { bold: true, color: { argb: C_SURFACE }, size: 12 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: C_PRIMARY },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: C_BORDER } },
    };
  });
  row.height = 22;
  return row;
}

function moneyCell(cell: ExcelJS.Cell, value: number) {
  cell.value = value;
  cell.numFmt = '#,##0.00" "';
  cell.font = { color: { argb: C_TEXT } };
}

export async function buildReportWorkbook(
  report: ReportData
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Focus Point";
  wb.created = new Date();

  const rangeLabel = `${report.from} إلى ${report.to}`;
  const title = "Focus Point — التقرير اليومي";

  // أدوات تنسيق زمنية مشتركة لكل الأوراق.
  const fmtDur = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("ar-SY") : "—";
  const fmtHM = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}س ${m}د`;
  };

  // ───────────────────────── 1) ملخص اليوم ─────────────────────────
  const s1 = wb.addWorksheet("ملخص اليوم", {
    views: [{ rightToLeft: true } as ExcelJS.WorksheetView],
  });
  s1.columns = colWidths([26, 18, 14, 40]);

  s1.getCell("A1").value = title;
  s1.getCell("A1").font = { bold: true, size: 16, color: { argb: C_PRIMARY } };
  s1.getCell("A2").value = `الفترة: ${rangeLabel}  |  ولُّد بآخر تحديث: ${new Date(
    report.generated_at
  ).toLocaleString("ar-SY")}  |  لقطة للقراءة فقط — البيانات تبقى محفوظة في القاعدة الأصلية`;
  s1.getCell("A2").font = { size: 10, color: { argb: C_MUTED } };

  headerRow(s1, ["البند", "القيمة", "الملاحظات", ""], 4);
  const rows: [string, string | number, string][] = [
    ["عدد الطلاب الزوار", report.summary.students_count, "طلاب سجلوا جلستهم أو طلبوا في الفترة"],
    ["عدد الجلسات", report.summary.sessions_count, "جلسات دخلت في الفترة"],
    ["إجمالي الطلبات", report.summary.orders_count, "كل الطلبات المسجلة في الفترة"],
    ["طلبات مكتملة (تم)", report.summary.done_count, "طلبات حُسمت وجُهّزت"],
    ["طلبات معلقة", report.summary.pending_count, "لم تُنفَّذ بعد (أُلغي تلقائياً في نهاية الجلسة إذا ظل معلقاً)"],
    ["طلبات ملغاة", report.summary.cancelled_count, "أُلغي تلقائياً عند إنهاء الجلسة"],
    ["إيرادات اليوم", report.summary.done_revenue, "مجموع سعر الطلبات المكتملة فقط (الخدمات)"],
    ["إجمالي الخصومات الممنوحة", report.summary.discounts_total, "خصومات طُبّقت عند إنهاء الجلسات في الفترة"],
    ["إيرادات الفترة (بعد الخصم)", report.summary.revenue, "الطلبات المكتملة + رسوم الجلسات المنتهية − الخصومات"],
    ["جلسات منتهية", report.summary.ended_sessions, "جلسات أُنهيت في الفترة (مسوّاة مالياً)"],
    ["الساعات المحتسبة", report.summary.billable_hours, "مجموع ساعات الجلسات المنتهية — حد أدنى ساعة للجلسة"],
    ["متوسط مدة الجلسة", fmtHM(report.summary.avg_billable_hours), "إجمالي الساعات ÷ عدد الجلسات المنتهية"],
  ];
  const MONEY_ROWS = new Set([
    "إيرادات اليوم",
    "إجمالي الخصومات الممنوحة",
    "إيرادات الفترة (بعد الخصم)",
  ]);
  rows.forEach(([label, value, note], i) => {
    const r = s1.getRow(5 + i);
    r.getCell(1).value = label;
    r.getCell(1).font = { bold: true, color: { argb: C_TEXT } };
    r.getCell(2).value = value;
    if (MONEY_ROWS.has(label)) moneyCell(r.getCell(2), value as number);
    r.getCell(3).value = note;
    r.getCell(3).font = { size: 10, color: { argb: C_MUTED } };
    if (i % 2 === 1) {
      r.eachCell((c) => {
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: C_BG },
        };
      });
    }
  });

  // جدول الخدمات داخل نفس الورقة — بعد صفوف الملخص بفراغ (حساب ديناميكي
  // حتى لا يتصادم رأس الجدول مع آخر صف بيانات عند إضافة بنود).
  const svcHeaderRow = 5 + rows.length + 1;
  headerRow(s1, ["الخدمة", "الطلبات", "المكتملة", "إيرادات (مرجعي)"], svcHeaderRow);
  report.services.forEach((sv, i) => {
    const r = s1.getRow(svcHeaderRow + 1 + i);
    r.getCell(1).value = sv.name;
    r.getCell(2).value = sv.count;
    r.getCell(3).value = sv.done_count;
    moneyCell(r.getCell(4), sv.done_total);
    r.getCell(2).alignment = { horizontal: "center" };
    r.getCell(3).alignment = { horizontal: "center" };
    r.getCell(4).alignment = { horizontal: "right" };
  });

  // ───────────────────────── 2) سجل الطلاب ─────────────────────────
  const s2 = wb.addWorksheet("سجل الطلاب", {
    views: [{ rightToLeft: true } as ExcelJS.WorksheetView],
  });
  s2.columns = colWidths([8, 28, 20, 14, 14, 16]);
  headerRow(s2, ["#", "اسم الطالب", "رقم الهاتف", "الجلسات", "الطلبات", "إجمالي مُنفّذ (ل.س)"], 1);
  report.students.forEach((st, i) => {
    const r = s2.getRow(2 + i);
    r.getCell(1).value = i + 1;
    r.getCell(2).value = st.name;
    r.getCell(3).value = st.phone ?? "—";
    r.getCell(4).value = st.sessions_count;
    r.getCell(5).value = st.orders_count;
    moneyCell(r.getCell(6), st.done_amount);
    r.getCell(4).alignment = { horizontal: "center" };
    r.getCell(5).alignment = { horizontal: "center" };
    r.getCell(6).alignment = { horizontal: "right" };
    if (i % 2 === 1) {
      r.eachCell((c) => {
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: C_BG },
        };
      });
    }
  });

  // ───────────────────────── 3) تفاصيل الطلبات ─────────────────────────
  const s3 = wb.addWorksheet("تفاصيل الطلبات", {
    views: [{ rightToLeft: true } as ExcelJS.WorksheetView],
  });
  s3.columns = colWidths([20, 26, 14, 14, 34, 8, 14, 16, 12]);
  headerRow(
    s3,
    [
      "وقت الطلب",
      "الطالب",
      "المكان",
      "الخدمة",
      "التفاصيل",
      "الكمية",
      "سعر الوحدة",
      "الإجمالي (ل.س)",
      "الحالة",
    ],
    1
  );
  const statusLabel: Record<string, string> = {
    pending: "معلّق",
    done: "تم",
    cancelled: "ملغى",
  };
  report.orders.forEach((o, i) => {
    const r = s3.getRow(2 + i);
    r.getCell(1).value = new Date(o.created_at).toLocaleString("ar-SY");
    r.getCell(2).value = o.student_name;
    const place = [
      o.group_label ?? "",
      typeof o.seat_number === "number" ? `مقعد ${o.seat_number}` : "",
    ]
      .filter(Boolean)
      .join(" • ");
    r.getCell(3).value = place || "—";
    r.getCell(4).value = o.service_name;
    r.getCell(5).value = o.details_label;
    r.getCell(6).value = o.units;
    r.getCell(6).alignment = { horizontal: "center" };
    moneyCell(r.getCell(7), o.price);
    moneyCell(r.getCell(8), o.total_price);
    r.getCell(9).value = statusLabel[o.status] ?? o.status;
    r.getCell(9).font = {
      bold: true,
      color: {
        argb:
          o.status === "done"
            ? C_SUCCESS
            : o.status === "cancelled"
              ? C_MAROON
              : C_PRIMARY,
      },
    };
    if (i % 2 === 1) {
      r.eachCell((c) => {
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: C_BG },
        };
      });
    }
  });

  // ───────────────────────── 4) الجلسات ─────────────────────────
  const s4 = wb.addWorksheet("الجلسات", {
    views: [{ rightToLeft: true } as ExcelJS.WorksheetView],
  });
  s4.columns = colWidths([26, 22, 16, 18, 16, 12, 16, 18]);
  headerRow(
    s4,
    [
      "وقت الدخول",
      "الطالب",
      "المكان",
      "المدة (ساعة:دقيقة)",
      "وقت الخروج",
      "الحالة",
      "الخصم (ل.س)",
      "المبلغ بعد الخصم (ل.س)",
    ],
    1
  );
  report.sessions.forEach((se, i) => {
    const r = s4.getRow(2 + i);
    r.getCell(1).value = fmtTime(se.check_in);
    r.getCell(2).value = se.student_name;
    const place = [
      se.group_label ?? "",
      typeof se.seat_number === "number" ? `مقعد ${se.seat_number}` : "",
    ]
      .filter(Boolean)
      .join(" • ");
    r.getCell(3).value = place || "—";
    r.getCell(4).value = fmtDur(se.duration_sec);
    r.getCell(5).value = fmtTime(se.check_out);
    r.getCell(6).value = se.status === "active" ? "نشطة" : "منتهية";
    r.getCell(6).font = {
      bold: true,
      color: { argb: se.status === "active" ? C_SUCCESS : C_MAROON },
    };
    moneyCell(r.getCell(7), se.discount_amount);
    moneyCell(r.getCell(8), se.final_total);
    if (i % 2 === 1) {
      r.eachCell((c) => {
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: C_BG },
        };
      });
    }
  });

  // ───────────────────── 5) السجل المالي (الجلسات) ─────────────
  // أعمدة الأرقام المالية كما يريدها صاحب المكان، مرتبة زمنياً من
  // الأقدم إلى الأحدث، مع صف «المجموع» يجمع الساعات والمبالغ كلها.
  const roomLabel: Record<string, string> = {
    social: "القاعة الاجتماعية",
    silent: "القاعة الصامتة",
    smoking: "منطقة التدخين",
  };
  const s5 = wb.addWorksheet("السجل المالي", {
    views: [{ rightToLeft: true } as ExcelJS.WorksheetView],
  });
  s5.columns = colWidths([24, 18, 20, 20, 18, 16, 16, 16, 16, 16, 18]);
  headerRow(
    s5,
    [
      "اسم الطالب",
      "القاعة",
      "وقت الدخول",
      "وقت الخروج",
      "المدة الفعلية",
      "الساعات المحتسبة",
      "مبلغ الجلسة",
      "مجموع الخدمات",
      "المبلغ الكلي",
      "الخصم",
      "المبلغ بعد الخصم",
    ],
    1
  );

  // السجل يعتمد الجلسات المنتهية فقط (المبالغ المسوّاة فعلياً).
  const financeSessions = report.sessions.filter(
    (se) => se.status === "ended"
  );
  let sumHours = 0;
  let sumSessions = 0;
  let sumServices = 0;
  let sumTotal = 0;
  let sumDiscount = 0;
  let sumFinal = 0;

  financeSessions.forEach((se, i) => {
    const r = s5.getRow(2 + i);
    r.getCell(1).value = se.student_name;
    r.getCell(1).font = { bold: true, color: { argb: C_TEXT } };
    r.getCell(2).value = se.room ? (roomLabel[se.room] ?? se.room) : "—";
    r.getCell(3).value = fmtTime(se.check_in);
    r.getCell(4).value = fmtTime(se.check_out);
    r.getCell(5).value = fmtDur(se.duration_sec);
    r.getCell(6).value = se.billable_hours;
    moneyCell(r.getCell(7), se.session_amount);
    moneyCell(r.getCell(8), se.services_total);
    moneyCell(r.getCell(9), se.total);
    moneyCell(r.getCell(10), se.discount_amount);
    moneyCell(r.getCell(11), se.final_total);
    r.getCell(6).alignment = { horizontal: "right" };
    if (i % 2 === 1) {
      r.eachCell((c) => {
        if (c.value !== undefined && c.value !== null) {
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: C_BG },
          };
        }
      });
    }
    sumHours += se.billable_hours;
    sumSessions += se.session_amount;
    sumServices += se.services_total;
    sumTotal += se.total;
    sumDiscount += se.discount_amount;
    sumFinal += se.final_total;
  });

  if (financeSessions.length > 0) {
    const rt = s5.getRow(2 + financeSessions.length);
    rt.getCell(1).value = "المجموع";
    rt.getCell(6).value = sumHours;
    moneyCell(rt.getCell(7), sumSessions);
    moneyCell(rt.getCell(8), sumServices);
    moneyCell(rt.getCell(9), sumTotal);
    moneyCell(rt.getCell(10), sumDiscount);
    moneyCell(rt.getCell(11), sumFinal);
    for (let c = 1; c <= 11; c += 1) {
      const cell = rt.getCell(c);
      cell.font = {
        bold: true,
        color: { argb: C_PRIMARY },
        size: 12,
      };
      cell.border = {
        top: { style: "medium", color: { argb: C_PRIMARY } },
      };
      if (c !== 2 && c !== 3 && c !== 4 && c !== 5) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: C_BG },
        };
      }
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  }

  // ───────────────────────── 6) الضيافة ─────────────────────────
  // ورقة إحصاء تقديري — لا تُحتسب في أي إجمالي مالي (بنّي/بيج).
  const s6 = wb.addWorksheet("الضيافة", {
    views: [{ rightToLeft: true } as ExcelJS.WorksheetView],
  });
  s6.columns = colWidths([24, 16, 24, 24, 12, 14, 18, 28]);
  headerRow(
    s6,
    [
      "الوقت",
      "النوع",
      "الاسم",
      "الصنف",
      "الكمية",
      "الأشخاص",
      "القيمة التقديرية",
      "ملاحظة",
    ],
    1
  );

  let sumHospQty = 0;
  let sumHospPeople = 0;
  let sumHospValue = 0;

  report.hospitality.forEach((h, i) => {
    const r = s6.getRow(2 + i);
    r.getCell(1).value = fmtTime(h.created_at);
    r.getCell(2).value =
      h.recipient_type === "management" ? "إدارة" : "ضيف";
    r.getCell(2).font = {
      bold: true,
      color: { argb: h.recipient_type === "management" ? C_MUTED : C_TEXT },
    };
    r.getCell(3).value = h.recipient_label;
    r.getCell(4).value = h.service_name;
    r.getCell(5).value = h.quantity;
    r.getCell(6).value = h.guests_count;
    moneyCell(r.getCell(7), h.estimated_value);
    r.getCell(8).value = h.note ?? "—";
    r.getCell(8).font = { color: { argb: C_MUTED } };
    if (i % 2 === 1) {
      r.eachCell((c) => {
        if (c.value !== undefined && c.value !== null) {
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: C_BG },
          };
        }
      });
    }
    sumHospQty += h.quantity;
    sumHospPeople += h.guests_count;
    sumHospValue = r2(sumHospValue + h.estimated_value);
  });

  if (report.hospitality.length > 0) {
    const rt = s6.getRow(2 + report.hospitality.length);
    rt.getCell(1).value = "المجموع (تقديري — لا يُحتسب إيراداً)";
    rt.getCell(5).value = sumHospQty;
    rt.getCell(6).value = sumHospPeople;
    moneyCell(rt.getCell(7), sumHospValue);
    for (let c = 1; c <= 8; c += 1) {
      const cell = rt.getCell(c);
      cell.font = { bold: true, color: { argb: C_MUTED }, size: 12 };
      cell.border = {
        top: { style: "medium", color: { argb: C_MUTED } },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      if (c !== 2 && c !== 3 && c !== 4 && c !== 8) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: C_BG },
        };
      }
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}