import type { Metadata } from "next";
import { cookies } from "next/headers";
import { requireAdminOrRedirect } from "@/lib/admin-require";
import { translate, langFromValue, LANG_COOKIE, type DictKey } from "@/lib/i18n";
import { SessionsTable } from "../SessionsTable";

export async function generateMetadata(): Promise<Metadata> {
  const store = await cookies();
  const lang = langFromValue(store.get(LANG_COOKIE)?.value);
  return { title: translate("admin.nav.sessions", lang) };
}

export default async function AdminSessionsPage() {
  await requireAdminOrRedirect();
  const store = await cookies();
  const lang = langFromValue(store.get(LANG_COOKIE)?.value);
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
    </div>
  );
}