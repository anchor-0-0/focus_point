import { cookies } from "next/headers";
import { translate, langFromValue, LANG_COOKIE } from "@/lib/i18n";

export default async function NotFound() {
  const store = await cookies();
  const lang = langFromValue(store.get(LANG_COOKIE)?.value);

  return (
    <main className="page">
      <div className="card text-center">
        <h1 className="card-title">{translate("notfound.title", lang)}</h1>
        <p className="text-muted">{translate("notfound.sub", lang)}</p>
      </div>
    </main>
  );
}