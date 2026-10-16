import type { Metadata } from "next";
import { cookies } from "next/headers";
import { requireAdminOrRedirect } from "@/lib/admin-require";
import { translate, langFromValue, LANG_COOKIE } from "@/lib/i18n";
import { TrainingManager } from "./TrainingManager";

export async function generateMetadata(): Promise<Metadata> {
  const store = await cookies();
  const lang = langFromValue(store.get(LANG_COOKIE)?.value);
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
