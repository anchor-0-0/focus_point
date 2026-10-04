"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useI18n } from "@/components/LanguageProvider";

type QrManagerProps = {
  fallbackUrl: string;
};

type DetectedAddress = {
  name: string;
  ip: string;
};

type ServerInfo = {
  addresses: DetectedAddress[];
  port: number;
  fallback: string;
  preferred: string | null;
};

type Status = "loading" | "ok" | "failed";

function buildUrl(ip: string, port: number) {
  return `http://${ip}:${port}/checkin`;
}

async function requestServerInfo(): Promise<ServerInfo> {
  const res = await fetch("/api/server-info", { cache: "no-store" });
  if (!res.ok) throw new Error("server-info-failed");
  const info = (await res.json()) as ServerInfo;
  if (!Array.isArray(info.addresses) || info.addresses.length === 0) {
    throw new Error("no-addresses");
  }
  return info;
}

// باركود الاستقبال — يتولد ديناميكياً من /api/server-info (IP الجهاز الفعلي
// على الشبكة)، مع قائمة شبكات عند تعدد الواجهات، زر تحديث، ومؤشر حالة.
export function QrManager({ fallbackUrl }: QrManagerProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>("loading");
  const [addresses, setAddresses] = useState<DetectedAddress[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [port, setPort] = useState(3000);
  const [url, setUrl] = useState(fallbackUrl);

  const applyInfo = useCallback((info: ServerInfo) => {
    const list = info.addresses;
    setAddresses(list);
    setPort(info.port);
    const chosen =
      info.preferred && list.some((a) => a.ip === info.preferred)
        ? info.preferred
        : list[0].ip;
    setSelected(chosen);
    setUrl(buildUrl(chosen, info.port));
    setStatus("ok");
  }, []);

  const applyFailure = useCallback(() => {
    setAddresses([]);
    setSelected(null);
    setUrl(fallbackUrl);
    setStatus("failed");
  }, [fallbackUrl]);

  useEffect(() => {
    let cancelled = false;
    requestServerInfo()
      .then((info) => {
        if (!cancelled) applyInfo(info);
      })
      .catch(() => {
        if (!cancelled) applyFailure();
      });
    return () => {
      cancelled = true;
    };
  }, [applyInfo, applyFailure]);

  const refresh = async () => {
    setStatus("loading");
    try {
      applyInfo(await requestServerInfo());
    } catch {
      applyFailure();
    }
  };

  const onSelect = (ip: string) => {
    setSelected(ip);
    setUrl(buildUrl(ip, port));
  };

  return (
    <div className="admin-qr-page">
      <div className="admin-qr-card">
        {(status === "ok" || addresses.length > 0) && (
          <div className="no-print admin-qr-controls">
            {addresses.length > 1 && (
              <label className="admin-qr-network">
                <span>{t("admin.qr.chooseNetwork")}</span>
                <select
                  className="admin-qr-select"
                  value={selected ?? ""}
                  onChange={(e) => onSelect(e.target.value)}
                >
                  {addresses.map((a) => (
                    <option key={a.ip} value={a.ip} dir="ltr">
                      {a.name} — {a.ip}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        <div className="no-print admin-qr-status">
          <span
            className={`admin-qr-dot admin-qr-dot-${status}`}
            aria-hidden="true"
          />
          <span>
            {status === "ok"
              ? t("admin.qr.connected")
              : status === "failed"
                ? t("admin.qr.failed")
                : t("admin.qr.discovering")}
          </span>
          <button type="button" className="admin-qr-refresh" onClick={refresh}>
            {t("admin.qr.refresh")}
          </button>
        </div>

        {status === "failed" && (
          <p className="no-print admin-qr-message" role="alert">
            {t("admin.qr.failedMsg")}
          </p>
        )}

        <p className="admin-qr-scan-hint">{t("admin.qr.scanHint")}</p>
        <div className="admin-qr-frame">
          <QRCodeSVG
            value={url}
            size={320}
            level="H"
            bgColor="#FFFFFF"
            fgColor="#402127"
            marginSize={4}
            title={t("admin.qr.codeTitle")}
            className="admin-qr-svg"
          />
        </div>
        <p className="no-print admin-qr-url" dir="ltr" title={t("admin.qr.urlTitle")}>
          {url}
        </p>
        <button
          type="button"
          className="no-print btn btn-primary admin-qr-print-btn"
          onClick={() => window.print()}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9V2h12v7" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" rx="1" />
          </svg>
          {t("admin.qr.print")}
        </button>
      </div>

      <p className="no-print admin-qr-note">
        {t("admin.qr.note")}
      </p>
    </div>
  );
}