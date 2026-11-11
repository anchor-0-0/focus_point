import type { Metadata } from "next";
import { requireAdminOrRedirect } from "@/lib/admin-require";
import { translate, type DictKey } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";
import { HospitalityManager } from "../HospitalityManager";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  return { title: translate("admin.nav.hospitality", lang) };
}

export default async function AdminHospitalityPage() {
  await requireAdminOrRedirect();
  const lang = await getServerLang();
  const t = (k: DictKey) => translate(k, lang);

  return (
    <div className="admin-page">
      <div>
        <h1 className="admin-section-title">{t("admin.hospitality.title")}</h1>
        <p className="text-sm text-muted">{t("admin.hospitality.sub")}</p>
      </div>
      <HospitalityManager />
    </div>
  );
}
