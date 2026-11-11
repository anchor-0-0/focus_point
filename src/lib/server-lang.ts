import { cookies } from "next/headers";
import { langFromValue, LANG_COOKIE, type Lang } from "./i18n";

export async function getServerLang(): Promise<Lang> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return "ar";
  }
  try {
    const store = await cookies();
    return langFromValue(store.get(LANG_COOKIE)?.value);
  } catch {
    return "ar";
  }
}
