import type { Metadata } from "next";
import { requireAdminOrRedirect } from "@/lib/admin-require";
import { translate, type DictKey } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";
import { OrdersFeed } from "../OrdersFeed";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  return { title: translate("admin.nav.orders", lang) };
}

export default async function AdminOrdersPage() {
  await requireAdminOrRedirect();
  const lang = await getServerLang();
  const t = (k: DictKey) => translate(k, lang);

  return (
    <div className="admin-page">
      <div>
        <h1 className="admin-section-title">{t("admin.nav.orders")}</h1>
        <p className="text-sm text-muted">
          {t("admin.orders.sub")}
        </p>
      </div>
      <OrdersFeed />
    </div>
  );
}