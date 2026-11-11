import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminOrRedirect } from "@/lib/admin-require";
import { getServerLang } from "@/lib/server-lang";
import { translate, type DictKey } from "@/lib/i18n";
import { DashboardStats } from "./DashboardStats";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  return { title: translate("admin.nav.overview", lang) };
}

export default async function AdminDashboardPage() {
  await requireAdminOrRedirect();
  const lang = await getServerLang();
  const t = (k: DictKey) => translate(k, lang);

  return (
    <div className="admin-page">
      <div>
        <h1 className="admin-section-title">{t("admin.nav.overview")}</h1>
        <p className="text-sm text-muted">
          {t("admin.dash.sub")}
        </p>
      </div>

      <DashboardStats />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink href="/admin/spaces" title={t("admin.nav.spaces")} desc={t("admin.dash.links.spaces.desc")} />
        <QuickLink href="/admin/sessions" title={t("admin.nav.sessions")} desc={t("admin.dash.links.sessions.desc")} />
        <QuickLink href="/admin/orders" title={t("admin.nav.orders")} desc={t("admin.dash.links.orders.desc")} />
      </div>
    </div>
  );
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-surface p-5 transition hover:border-primary"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted">{desc}</p>
    </Link>
  );
}