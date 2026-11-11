import type { Metadata } from "next";
import { requireAdminOrRedirect } from "@/lib/admin-require";
import { translate } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";
import { TrainingManager } from "./TrainingManager";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  return { title: translate("admin.nav.training", lang) };
}

export default async function AdminTrainingPage() {
  await requireAdminOrRedirect();

  return (
    <div className="admin-page">
      <TrainingManager />
    </div>
  );
}
