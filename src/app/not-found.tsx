import { translate } from "@/lib/i18n";
import { getServerLang } from "@/lib/server-lang";

export default async function NotFound() {
  const lang = await getServerLang();

  return (
    <main className="page">
      <div className="card text-center">
        <h1 className="card-title">{translate("notfound.title", lang)}</h1>
        <p className="text-muted">{translate("notfound.sub", lang)}</p>
      </div>
    </main>
  );
}