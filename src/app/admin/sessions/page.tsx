import type { Metadata } from "next";
import { requireAdminOrRedirect } from "@/lib/admin-require";
import { translate, type DictKey } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";
import { SessionsTable } from "../SessionsTable";
import { SessionsHistory } from "../SessionsHistory";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  return { title: translate("admin.nav.sessions", lang) };
}

export default async function AdminSessionsPage() {
  await requireAdminOrRedirect();
  const lang = await getServerLang();
  const t = (k: DictKey) => translate(k, lang);

  return (
    <div className="admin-page">
      <div>
        <h1 className="admin-section-title">{t("admin.nav.sessions")}</h1>
        <p className="text-sm text-muted">
          {t("admin.sessions.sub")}
        </p>
      </div>
      <SessionsTable />
      <SessionsHistory />
    </div>
  );
}