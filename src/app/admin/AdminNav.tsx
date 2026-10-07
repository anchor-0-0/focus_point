"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/components/LanguageProvider";

const LINKS = [
  { href: "/admin", key: "admin.nav.overview" },
  { href: "/admin/spaces", key: "admin.nav.spaces" },
  { href: "/admin/sessions", key: "admin.nav.sessions" },
  { href: "/admin/orders", key: "admin.nav.orders" },
  { href: "/admin/report", key: "admin.nav.report" },
  { href: "/admin/services", key: "admin.nav.services" },
  { href: "/admin/qr-code", key: "admin.nav.qr" },
  { href: "/admin/settings", key: "admin.nav.settings" },
] as const;

type NavKey = (typeof LINKS)[number]["key"];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export function LogoutButton() {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10 focus:outline-none"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.replace("/admin/login");
      }}
    >
      {t("admin.logout")}
    </button>
  );
}

export function LogoutIconButton() {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="rounded-lg px-3 py-1.5 text-sm text-danger hover:bg-danger/10 focus:outline-none"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.replace("/admin/login");
      }}
    >
      {t("admin.logout")}
    </button>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav className="flex flex-1 flex-col justify-between p-3">
      <ul className="flex flex-col gap-1">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "admin-nav-link-active"
                    : "text-foreground hover:bg-primary-soft"
                }`}
              >
                {t(link.key as NavKey)}
              </Link>
            </li>
          );
        })}
      </ul>
      <LogoutButton />
    </nav>
  );
}

export function AdminNavCompact() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <ul className="flex gap-1">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition ${
                active
                  ? "bg-primary text-white"
                  : "text-foreground hover:bg-primary-soft"
              }`}
            >
              {t(link.key as NavKey)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}