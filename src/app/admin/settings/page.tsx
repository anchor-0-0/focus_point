import type { Metadata } from "next";
import { requireAdminOrRedirect } from "@/lib/admin-require";
import { prisma } from "@/lib/prisma";
import { readHourlyRate } from "@/lib/settings";
import { translate, type DictKey } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";
import { SettingsManager } from "../SettingsManager";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  return { title: translate("admin.nav.settings", lang) };
}

export default async function AdminSettingsPage() {
  await requireAdminOrRedirect();
  const lang = await getServerLang();
  const t = (k: DictKey) => translate(k, lang);

  const initialRate =
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
      ? 5000
      : await readHourlyRate(prisma);

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