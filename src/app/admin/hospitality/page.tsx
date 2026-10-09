import type { Metadata } from "next";
import { cookies } from "next/headers";
import { requireAdminOrRedirect } from "@/lib/admin-require";
import { translate, langFromValue, LANG_COOKIE, type DictKey } from "@/lib/i18n";
import { HospitalityManager } from "../HospitalityManager";

export async function generateMetadata(): Promise<Metadata> {
  const store = await cookies();
  const lang = langFromValue(store.get(LANG_COOKIE)?.value);
  return { title: translate("admin.nav.hospitality", lang) };
}

export default async function AdminHospitalityPage() {
  await requireAdminOrRedirect();
  const store = await cookies();
  const lang = langFromValue(store.get(LANG_COOKIE)?.value);
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
