import type { Metadata } from "next";
import { cookies } from "next/headers";
import { requireAdminOrRedirect } from "@/lib/admin-require";
import { prisma } from "@/lib/prisma";
import { readHourlyRate } from "@/lib/settings";
import { translate, langFromValue, LANG_COOKIE, type DictKey } from "@/lib/i18n";
import { SettingsManager } from "../SettingsManager";

export async function generateMetadata(): Promise<Metadata> {
  const store = await cookies();
  const lang = langFromValue(store.get(LANG_COOKIE)?.value);
  return { title: translate("admin.nav.settings", lang) };
}

export default async function AdminSettingsPage() {
  await requireAdminOrRedirect();
  const store = await cookies();
  const lang = langFromValue(store.get(LANG_COOKIE)?.value);
  const t = (k: DictKey) => translate(k, lang);

  const initialRate = await readHourlyRate(prisma);

  return (
    <div className="admin-page">
      <div>
        <h1 className="admin-section-title">{t("admin.nav.settings")}</h1>
        <p className="text-sm text-muted">{t("admin.settings.sub")}</p>
      </div>
      <SettingsManager initialRate={initialRate} />
    </div>
  );
}