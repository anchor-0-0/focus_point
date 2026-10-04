"use client";

import { useCallback, useRef, useState } from "react";
import { usePolling } from "@/lib/admin-hooks";
import { POLL_STANDARD_MS } from "@/lib/admin-poll";
import { SkeletonLines } from "@/components/SkeletonLines";
import { useI18n } from "@/components/LanguageProvider";

type OccupancyRow = {
  room: string;
  occupied: number;
  total: number;
};

type Stats = {
  revenue: number;
  done_count: number;
  occupied_total: number;
  total_spots: number;
  occupancy: OccupancyRow[];
};

export function DashboardStats() {
  const { t, tw } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStats(data);
        setError(null);
      } else {
        setError(data.error ?? t("admin.err.load"));
      }
    } catch {
      setError(t("admin.err.network"));
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [t]);

  usePolling(load, POLL_STANDARD_MS);

  if (!stats) {
    return <SkeletonLines rows={3} />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  const socialRow = stats.occupancy.find((r) => r.room === "social");
  const silentRow = stats.occupancy.find((r) => r.room === "silent");
  const smokingRow = stats.occupancy.find((r) => r.room === "smoking");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* بطاقة الإيرادات — بطلة الداشبورد بخلفية عنابية */}
      <section className="stat-card-hero">
        <div>
          <h2 className="stat-label">{t("admin.stats.revenue")}</h2>
          <p className="stat-value tabular-nums">
            {stats.revenue.toFixed(2)} <span className="text-base font-medium text-white/85">{t("admin.currency")}</span>
          </p>
          <p className="stat-sub">
            {tw("admin.stats.done", { n: stats.done_count })}{" "}
            {refreshing && `• ${t("admin.stats.refreshing")}`}
          </p>
        </div>
      </section>

      {/* بطاقة الإشغال الحي — حد جانبي سميك بلون بني */}
      <section
        className="stat-card flex flex-col justify-between gap-4"
        style={{ borderInlineStart: "4px solid var(--color-brown)" }}
      >
        <div>
          <h2 className="stat-label">{t("admin.stats.occupancy")}</h2>
          <p className="stat-value tabular-nums">
            {stats.occupied_total} <span className="text-base font-medium">{tw("admin.stats.of", { total: stats.total_spots })}</span>
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <OccupancyBar
            label={t("admin.room.social")}
            occupied={socialRow?.occupied ?? 0}
            total={socialRow?.total ?? 0}
          />
          <OccupancyBar
            label={t("admin.room.silent")}
            occupied={silentRow?.occupied ?? 0}
            total={silentRow?.total ?? 0}
          />
          <OccupancyBar
            label={t("admin.room.smoking")}
            occupied={smokingRow?.occupied ?? 0}
            total={smokingRow?.total ?? 0}
          />
        </div>
      </section>
    </div>
  );
}

function OccupancyBar({
  label,
  occupied,
  total,
}: {
  label: string;
  occupied: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums text-foreground">
          {occupied} / {total}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary-soft">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-[400ms]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}