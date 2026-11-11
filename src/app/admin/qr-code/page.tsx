import type { Metadata } from "next";
import { requireAdminOrRedirect } from "@/lib/admin-require";
import { translate, type DictKey } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";
import { QrManager } from "../QrManager";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  return { title: translate("admin.nav.qr", lang) };
}

const DEFAULT_CHECKIN_URL = "http://localhost:3000/checkin";

export default async function AdminQrCodePage() {
  await requireAdminOrRedirect();
  const lang = await getServerLang();
  const t = (k: DictKey) => translate(k, lang);

  // يُستخدم احتياطياً فقط لو فشل الاكتشاف التلقائي لشبكات الجهاز؛
  // الباركود الأساسي يُبنى ديناميكياً من /api/server-info.
  const fallbackUrl =
    process.env.NEXT_PUBLIC_CHECKIN_URL?.trim() || DEFAULT_CHECKIN_URL;

  return (
    <div className="admin-page">
      <div>
        <h1 className="admin-section-title">{t("admin.nav.qr")}</h1>
        <p className="text-sm text-muted">
          {t("admin.qr.sub")}
        </p>
      </div>
      <QrManager fallbackUrl={fallbackUrl} />
    </div>
  );
}