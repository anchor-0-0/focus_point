import type { Metadata } from "next";
import { cookies } from "next/headers";
import { requireAdminOrRedirect } from "@/lib/admin-require";
import { translate, langFromValue, LANG_COOKIE, type DictKey } from "@/lib/i18n";
import {
  damascusToday,
  damascusDayBoundaries,
  fetchReport,
} from "@/lib/report";
import { ReportClient } from "../ReportClient";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const store = await cookies();
  const lang = langFromValue(store.get(LANG_COOKIE)?.value);
  return { title: translate("admin.nav.report", lang) };
}

export default async function AdminReportPage() {
  await requireAdminOrRedirect();
  const store = await cookies();
  const lang = langFromValue(store.get(LANG_COOKIE)?.value);
  const t = (k: DictKey) => translate(k, lang);

  const today = damascusToday();
  const { fromDate, toDate } = damascusDayBoundaries(today, today);
  const initial = await fetchReport(fromDate, toDate, today, today);

  return (
    <div className="admin-page">
      <div>
        <h1 className="admin-section-title">{t("admin.nav.report")}</h1>
        <p className="text-sm text-muted">
          {t("admin.report.sub")}
        </p>
      </div>

      <ReportClient initial={initial} />
    </div>
  );
}