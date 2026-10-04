import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { translate, langFromValue, LANG_COOKIE } from "@/lib/i18n";
import { ServicesClient, type ServiceDto } from "./ServicesClient";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const store = await cookies();
  const lang = langFromValue(store.get(LANG_COOKIE)?.value);
  return { title: translate("services.title", lang) };
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const store = await cookies();
  const lang = langFromValue(store.get(LANG_COOKIE)?.value);
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
            style={{ backgroundColor: "rgba(153, 127, 104, 0.12)" }}
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