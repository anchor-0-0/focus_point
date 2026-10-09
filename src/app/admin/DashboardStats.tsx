"use client";

import { useCallback, useRef, useState } from "react";
import { usePolling } from "@/lib/admin-hooks";
import { POLL_STANDARD_MS } from "@/lib/admin-poll";
import { SkeletonLines } from "@/components/SkeletonLines";
import { useI18n } from "@/components/LanguageProvider";
import { formatThousands } from "@/lib/money";
import { durationHM } from "@/lib/format";
import { RoomHoursRow } from "@/components/RoomHoursRow";

type OccupancyRow = {
  room: string;
  occupied: number;
  total: number;
};

type Stats = {
  revenue: number;
  revenue_services: number;
  revenue_sessions: number;
  discounts_total: number;
  done_count: number;
  billed_hours_today: number;
  ended_sessions_today: number;
  avg_billable_hours: number;
  hours_by_room: { social: number; silent: number; smoking: number };
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
  const roomHoursMax = Math.max(
    stats.hours_by_room.social,
    stats.hours_by_room.silent,
    stats.hours_by_room.smoking,
    1
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* بطاقة الإيرادات — بطلة الداشبورد بخلفية عنابية */}
        <section className="stat-card-hero">
          <div>
            <h2 className="stat-label">{t("admin.stats.revenue")}</h2>
            <p className="stat-value tabular-nums">
              {formatThousands(stats.revenue)} <span className="text-base font-medium text-white/85">{t("admin.currency")}</span>
            </p>
            <p className="stat-sub">
              {stats.discounts_total > 0
                ? tw("admin.stats.revenueBreakdownDisc", {
                    s: `${formatThousands(stats.revenue_sessions)} ${t("admin.currency")}`,
                    o: `${formatThousands(stats.revenue_services)} ${t("admin.currency")}`,
                    d: `${formatThousands(stats.discounts_total)} ${t("admin.currency")}`,
                  })
                : tw("admin.stats.revenueBreakdown", {
                    s: `${formatThousands(stats.revenue_sessions)} ${t("admin.currency")}`,
                    o: `${formatThousands(stats.revenue_services)} ${t("admin.currency")}`,
                  })}
            </p>
            {stats.discounts_total > 0 && (
              <p className="stat-sub">
                {t("admin.stats.discounts")}:{" "}
                <span className="tabular-nums">
                  {formatThousands(stats.discounts_total)} {t("admin.currency")}
                </span>
              </p>
            )}
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

      {/* ساعات اليوم — قسم التقارير بالساعات */}
      <div className="grid gap-4 sm:grid-cols-3">
        <section className="stat-card flex flex-col justify-between gap-4">
          <div>
            <h2 className="stat-label">{t("admin.stats.billableHours")}</h2>
            <p className="stat-value tabular-nums">
              {stats.billed_hours_today}{" "}
              <span className="text-xl font-semibold text-muted">{t("common.hourShort")}</span>
            </p>
            <p className="stat-sub">
              {tw("admin.stats.endedSessions", { n: stats.ended_sessions_today })}
            </p>
          </div>
        </section>

        <section className="stat-card flex flex-col justify-between gap-4">
          <div>
            <h2 className="stat-label">{t("admin.stats.avgSession")}</h2>
            <p className="stat-value text-3xl tabular-nums">
              {durationHM(
                stats.avg_billable_hours * 3600 * 1000,
                t("common.hourShort"),
                t("common.minuteShort")
              )}
            </p>
            <p className="stat-sub">{t("admin.stats.avgSub")}</p>
          </div>
        </section>

        <section
          className="stat-card flex flex-col justify-between gap-4"
          style={{ borderInlineStart: "4px solid var(--color-primary)" }}
        >
          <h2 className="stat-label">{t("admin.stats.hoursByRoom")}</h2>
          <RoomHoursRow
            label={t("admin.room.social")}
            value={stats.hours_by_room.social}
            max={roomHoursMax}
          />
          <RoomHoursRow
            label={t("admin.room.silent")}
            value={stats.hours_by_room.silent}
            max={roomHoursMax}
          />
          <RoomHoursRow
            label={t("admin.room.smoking")}
            value={stats.hours_by_room.smoking}
            max={roomHoursMax}
          />
        </section>
      </div>
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