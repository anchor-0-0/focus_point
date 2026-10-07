import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  translate,
  langFromValue,
  LANG_COOKIE,
  roomName,
  type DictKey,
  type Lang,
} from "@/lib/i18n";
import { computeBilling } from "@/lib/billing";
import { readHourlyRate } from "@/lib/settings";
import { orderTotal, orderUnits, type OrderDetails } from "@/lib/orders";
import { ClearActiveSession } from "@/components/ClearActiveSession";
import { InvoiceModal } from "@/components/InvoiceModal";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const store = await cookies();
  const lang = langFromValue(store.get(LANG_COOKIE)?.value);
  return { title: translate("ended.title", lang) };
}

const pad = (n: number) => String(n).padStart(2, "0");

// تنسيق المدة بطريقة ساعة:دقيقة:ثانية (للملخص السريع).
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// تنسيق المدة بجملة عربية/إنجليزية مقروءة (مثلاً: "1 ساعة و31 دقيقة").
function formatDurationText(ms: number, lang: Lang): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const t = (k: DictKey) => translate(k, lang);
  const hourWord = t(hours === 1 ? "ended.duration.hour" : "ended.duration.hours");
  const minWord = t(minutes === 1 ? "ended.duration.minute" : "ended.duration.minutes");
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hourWord}`);
  if (minutes > 0) parts.push(`${minutes} ${minWord}`);
  if (parts.length === 0) return `0 ${t("ended.duration.minutes")}`;
  return parts.join(t("ended.duration.and"));
}

// اسم موقع الجلسة (كلمة الطاولة/البار + الرقم) حسب اللغة.
function placeLabel(groupLabel: string, lang: Lang): string {
  const t = (k: DictKey) => translate(k, lang);
  switch (groupLabel) {
    case "social_table":
      return t("session.spot.table");
    case "silent_writing":
      return t("session.spot.writingTable");
    case "silent_bar":
      return t("session.spot.studyBar");
    case "smoking_bar":
      return t("session.spot.smokingBar");
    default:
      return groupLabel;
  }
}

export default async function EndedSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let lang = "ar" as "ar" | "en";
  try {
    const store = await cookies();
    lang = langFromValue(store.get(LANG_COOKIE)?.value);
  } catch {
    // بيئة دون كوكيز — نبقى على العربية الافتراضية.
  }

  const t = (k: DictKey) => translate(k, lang);
  const locale = t("meta.locale");

  // قراءة الجلسة مع كل ما تحتاجه الفاتورة: الطالب، المكان، الحقائق المالية،
  // والطلبات المنفذة (done) فقط — الملغاة والمعلقة لا تدخل الفاتورة أبداً.
  let invoice: {
    guest: string;
    phone: string | null;
    place: string;
    checkInText: string;
    checkOutText: string;
    issueDateText: string;
    durationText: string;
    billableHours: number;
    hourlyRate: number;
    sessionAmount: number;
    services: { name: string; price: number; units: number; total: number }[];
    servicesTotal: number;
    total: number;
  } | null = null;

  let duration: string | null = null;
  let orderCount: number | null = null;

  try {
    const session = await prisma.session.findUnique({
      where: { id },
      select: {
        checkIn: true,
        checkOut: true,
        status: true,
        billableHours: true,
        sessionAmount: true,
        hourlyRateSnapshot: true,
        student: { select: { name: true, phone: true } },
        spot: { select: { room: true, seatGroup: true, seatNumber: true } },
        orders: {
          where: { status: "done" },
          orderBy: { createdAt: "asc" },
          select: {
            details: true,
            service: { select: { name: true, price: true } },
          },
        },
        _count: {
          select: {
            orders: { where: { status: { not: "cancelled" } } },
          },
        },
      },
    });

    if (session) {
      const checkIn = session.checkIn;
      const checkOut = session.checkOut ?? new Date();
      const totalMs = Math.max(0, checkOut.getTime() - checkIn.getTime());

      duration = formatDuration(totalMs);
      orderCount = session._count.orders;

      // حقائق الفوترة: نستخدم لقطة الجلسة إن وُجدت (ميزة الفواتير)، وإن كانت
      // الجلسة منتهية قبل الميزة نحسبها الآن للمعروض دون تعديل القاعدة.
      let billableHours = session.billableHours;
      let sessionAmount = session.sessionAmount ? Number(session.sessionAmount) : null;
      let hourlyRate = session.hourlyRateSnapshot ? Number(session.hourlyRateSnapshot) : null;
      if (billableHours == null || sessionAmount == null || hourlyRate == null) {
        const currentRate = await readHourlyRate(prisma);
        const billing = computeBilling(checkIn, checkOut, currentRate);
        billableHours = billing.billableHours;
        sessionAmount = billing.amount;
        hourlyRate = currentRate;
      }

      const services = session.orders.map((o) => {
        const details = (o.details as OrderDetails | null) ?? null;
        const unitPrice = Number(o.service.price);
        return {
          name: o.service.name,
          price: unitPrice,
          units: orderUnits(details),
          total: orderTotal(unitPrice, details),
        };
      });
      const servicesTotal = services.reduce((sum, s) => sum + s.total, 0);

      const place = `${roomName(session.spot.room, lang)} — ${placeLabel(
        session.spot.seatGroup,
        lang
      )} ${session.spot.seatNumber}`;

      invoice = {
        guest: session.student.name,
        phone: session.student.phone,
        place,
        checkInText: new Date(checkIn).toLocaleString(locale),
        checkOutText: new Date(checkOut).toLocaleString(locale),
        issueDateText: new Date(checkOut).toLocaleString(locale),
        durationText: formatDurationText(totalMs, lang),
        billableHours,
        hourlyRate,
        sessionAmount,
        services,
        servicesTotal,
        total: sessionAmount + servicesTotal,
      };
    }
  } catch (err) {
    console.error("EndedSessionPage DB error:", err);
  }

  return (
    <main className="page">
      {/* مسح معرف الجلسة المخزّن أياً كان طريق الوصول لهذه الصفحة */}
      <ClearActiveSession />

      {/* قائمة المحتوى العلوي (لا تُطبع) */}
      <div className="w-full max-w-md text-center animate-fade-in-up no-print">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/v1-dark.svg"
          alt="Focus Point"
          width={71}
          height={48}
          className="mx-auto h-12 w-auto object-contain"
        />
        <span className="badge badge-live mx-auto mt-4 w-fit">
          <span className="pulse-dot" />
          {t("ended.title")}
        </span>
        <h2 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
          {t("ended.thanks")}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-muted">
          {t("ended.body")}
        </p>

        {(duration !== null || orderCount !== null) && (
          <>
            <div className="focus-divider" aria-hidden="true">
              <span className="focus-divider-dot" />
            </div>

            <div className="summary-card">
              <div className="summary-item">
                <span className="summary-label">{t("ended.duration")}</span>
                <span className="summary-value" dir="ltr">
                  {duration}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{t("ended.orders")}</span>
                <span className="summary-value">{orderCount}</span>
              </div>
            </div>
          </>
        )}

        <p className="mt-6 text-sm italic text-tan">{t("ended.note")}</p>

        {/* الفاتورة — تُفتح كنافذة منبثقة، والمحتوى المحيط يُطبخ خلفها */}
        {invoice && <InvoiceModal invoice={invoice} />}

        <div className="badge badge-done mx-auto mt-6 w-fit">
          {t("ended.badge")}
        </div>
        <Link href="/checkin" className="btn btn-primary mt-6 w-full">
          {t("ended.register")}
        </Link>
      </div>
    </main>
  );
}