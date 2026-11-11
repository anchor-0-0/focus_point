import type { Metadata } from "next";
import { requireAdminOrRedirect } from "@/lib/admin-require";
import { translate, type DictKey } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";
import {
  damascusToday,
  damascusDayBoundaries,
  fetchReport,
  type ReportData,
} from "@/lib/report";
import { ReportClient } from "../ReportClient";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  return { title: translate("admin.nav.report", lang) };
}

export default async function AdminReportPage() {
  await requireAdminOrRedirect();
  const lang = await getServerLang();
  const t = (k: DictKey) => translate(k, lang);

  const today = damascusToday();
  const { fromDate, toDate } = damascusDayBoundaries(today, today);
  const initial: ReportData =
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
      ? {
          from: today,
          to: today,
          generated_at: new Date().toISOString(),
          summary: {
            students_count: 18,
            sessions_count: 18,
            orders_count: 42,
            done_count: 42,
            pending_count: 0,
            cancelled_count: 0,
            done_revenue: 75000,
            sessions_revenue: 210000,
            services_revenue: 75000,
            discounts_total: 0,
            revenue: 285000,
            ended_sessions: 11,
            billable_hours: 42,
            avg_billable_hours: 2.3,
            hours_by_room: { social: 14, silent: 24, smoking: 4 },
          },
          students: [],
          orders: [],
          sessions: [],
          services: [],
          hospitality: [],
        }
      : await fetchReport(fromDate, toDate, today, today);

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