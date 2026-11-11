import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { translate } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";
import { ServicesClient, type ServiceDto } from "./ServicesClient";

export function generateStaticParams() {
  return [{ id: "demo" }];
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  return { title: translate("services.title", lang) };
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (id === "demo" || process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const demoServices: ServiceDto[] = [
      { id: "s-1", name: "قهوة تركي", category: "مشروبات ساخنة", price: 2500 },
      { id: "s-2", name: "إسبريسو", category: "مشروبات ساخنة", price: 3000 },
      { id: "s-3", name: "كابتشينو", category: "مشروبات ساخنة", price: 3500 },
      { id: "s-4", name: "شاي خمير", category: "مشروبات ساخنة", price: 2000 },
      { id: "s-5", name: "مياه معدنية", category: "مشروبات باردة", price: 1500 },
      { id: "s-6", name: "طباعة A4 أبيض وأسود", category: "خدمات مكتبية", price: 500 },
      { id: "s-7", name: "طباعة A4 ملون", category: "خدمات مكتبية", price: 1500 },
    ];
    return (
      <ServicesClient
        sessionId="demo"
        checkInIso={new Date(Date.now() - 42 * 60 * 1000).toISOString()}
        serverNowIso={new Date().toISOString()}
        services={demoServices}
      />
    );
  }

  const lang = await getServerLang();
  const tr = (k: Parameters<typeof translate>[0]) => translate(k, lang);

  // ملاحظة: redirect/notFound يجب استدعاؤهما خارج try (توثيق Next.js).
  const session = await prisma.session
    .findUnique({
      where: { id },
      select: { id: true, status: true, checkIn: true },
    })
    .catch((err) => {
      console.error("ServicesPage DB error:", err);
      return null;
    });

  // جلسة غير موجودة → 404
  if (!session) {
    notFound();
  }

  // جلسة غير نشطة → صفحة الانتهاء.
  if (session.status !== "active") {
    redirect(`/session/${id}/ended`);
  }

  const services = await prisma.service
    .findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    })
    .catch((err) => {
      console.error("ServicesPage services DB error:", err);
      return null;
    });

  if (services === null) {
    return (
      <main className="page">
        <div className="card">
          <h1 className="card-title">{tr("services.err.title")}</h1>
          <p className="error">{tr("services.err.body")}</p>
        </div>
      </main>
    );
  }

  const normalized: ServiceDto[] = services.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price.toNumber(),
  }));

  if (normalized.length === 0) {
    return (
      <main className="page">
        <div className="card text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "color-mix(in srgb, var(--color-tan) 12%, transparent)" }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ color: "var(--color-tan)" }}
            >
              <path d="M10.5 5h3a1.5 1.5 0 0 1 1.5 1.5v1.5h4.5A1.5 1.5 0 0 1 21 9.5v9A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5v-9A1.5 1.5 0 0 1 4.5 8H9V6.5A1.5 1.5 0 0 1 10.5 5Z" />
            </svg>
          </div>
          <h1 className="card-title">{tr("services.empty.title")}</h1>
          <p className="text-sm text-muted">
            {tr("services.empty.body")}
          </p>
          <a href={`/session/${session.id}`} className="btn btn-option mt-6">
            {tr("services.backToSession")}
          </a>
        </div>
      </main>
    );
  }

  return (
    <ServicesClient
      sessionId={session.id}
      services={normalized}
      checkInIso={session.checkIn.toISOString()}
      serverNowIso={new Date().toISOString()}
    />
  );
}