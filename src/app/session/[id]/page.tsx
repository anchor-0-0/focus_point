import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerLang } from "@/lib/server-lang";
import { SessionClient } from "./SessionClient";
import { EndedRedirect } from "./EndedRedirect";
import { translate } from "@/lib/i18n";

export function generateStaticParams() {
  return [{ id: "demo" }];
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  return { title: translate("session.metaTitle", lang) };
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (id === "demo" || process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const demoStart = new Date(Date.now() - 42 * 60 * 1000);
    return (
      <SessionClient
        sessionId="demo"
        checkInIso={demoStart.toISOString()}
        serverNowIso={new Date().toISOString()}
        room="silent"
        groupLabel="القاعة الصامتة"
        seatNumber={7}
      />
    );
  }

  // رابط بمعرّف عشوائي/مبتور → 404 منطقي، لا خطأ قاعدة بيانات.
  if (!UUID_RE.test(id)) {
    notFound();
  }

  // ملاحظة: redirect/notFound يجب استدعاؤهما خارج try (توثيق Next.js).
  // خطأ قاعدة البيانات (انقطاع اتصال مثلاً) يُعاد رميه ليلتقطه error.tsx
  // ويعرض رسالة عربية واضحة — بدل معاملته كـ "غير موجودة".
  const session = await prisma.session
    .findUnique({
      where: { id },
      include: {
        spot: {
          select: { room: true, groupLabel: true, seatNumber: true },
        },
      },
    })
    .catch((err) => {
      console.error("SessionPage DB error:", err);
      throw err;
    });

  // جلسة غير موجودة → 404 منطقي (وليست تعطّل)
  if (!session) {
    notFound();
  }

  // جلسة منتهية مسبقاً (وصل لها الطالب مباشرة عبر الرابط): نوجه لصفحة
  // الانتهاء عبر router.replace (وليس redirect من السيرفر) حتى لا يتكدس
  // عنوان /session في سجل التصفح خلف /ended فيقع زر الرجوع بحلقة.
  if (session.status === "ended") {
    return <EndedRedirect sessionId={session.id} />;
  }

  return (
    <SessionClient
      sessionId={session.id}
      checkInIso={session.checkIn.toISOString()}
      serverNowIso={new Date().toISOString()}
      room={session.spot?.room ?? null}
      groupLabel={session.spot?.groupLabel ?? null}
      seatNumber={session.spot?.seatNumber ?? null}
    />
  );
}