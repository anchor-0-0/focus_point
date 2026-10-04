import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { translate, langFromValue, LANG_COOKIE } from "@/lib/i18n";
import { ClearActiveSession } from "@/components/ClearActiveSession";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const store = await cookies();
  const lang = langFromValue(store.get(LANG_COOKIE)?.value);
  return { title: translate("ended.title", lang) };
}

// تنسيق المدة بطريقة ساعة:دقيقة:ثانية.
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
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

  // ملخص الجلسة: قراءة فقط لعرض البيانات (كما تفعل الصفحات الأخرى عبر prisma).
  let duration: string | null = null;
  let orderCount: number | null = null;
  try {
    const session = await prisma.session.findUnique({
      where: { id },
      select: {
        checkIn: true,
        checkOut: true,
        _count: {
          select: {
            // لا نحتسب الطلبات الملغاة تلقائياً (cancelled) ضمن عدد الطلبات
            // لأنها لم تُلبَّ فعلياً — فقط done و pending.
            orders: { where: { status: { not: "cancelled" } } },
          },
        },
      },
    });
    if (session) {
      const end = session.checkOut ?? new Date();
      duration = formatDuration(end.getTime() - session.checkIn.getTime());
      orderCount = session._count.orders;
    }
  } catch (err) {
    console.error("EndedSessionPage DB error:", err);
  }

  return (
    <main className="page">
      {/* مسح معرف الجلسة المخزّن أياً كان طريق الوصول لهذه الصفحة */}
      <ClearActiveSession />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/v1-dark.svg"
        alt="Focus Point"
        width={71}
        height={48}
        className="mx-auto h-12 w-auto object-contain animate-fade-in-up"
      />
      <div className="w-full max-w-md text-center animate-fade-in-up">
        <span className="badge badge-live mx-auto w-fit">
          <span className="pulse-dot" />
          {translate("ended.title", lang)}
        </span>
        <h2 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
          {translate("ended.thanks", lang)}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-muted">
          {translate("ended.body", lang)}
        </p>

        {(duration !== null || orderCount !== null) && (
          <>
            <div className="focus-divider" aria-hidden="true">
              <span className="focus-divider-dot" />
            </div>

            <div className="summary-card">
              <div className="summary-item">
                <span className="summary-label">{translate("ended.duration", lang)}</span>
                <span className="summary-value" dir="ltr">
                  {duration}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{translate("ended.orders", lang)}</span>
                <span className="summary-value">{orderCount}</span>
              </div>
            </div>
          </>
        )}

        <p className="mt-6 text-sm italic text-tan">{translate("ended.note", lang)}</p>

        <div className="badge badge-done mx-auto mt-6 w-fit">
          {translate("ended.badge", lang)}
        </div>
        <Link href="/checkin" className="btn btn-primary mt-6 w-full">
          {translate("ended.register", lang)}
        </Link>
      </div>
    </main>
  );
}