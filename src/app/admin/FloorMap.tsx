"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePolling } from "@/lib/admin-hooks";
import { POLL_STANDARD_MS } from "@/lib/admin-poll";
import { SkeletonLines } from "@/components/SkeletonLines";
import { EmptyState } from "@/components/EmptyState";
import { useI18n } from "@/components/LanguageProvider";
import { SessionDetailPanel } from "./SessionDetailPanel";

// ============================================================
// خريطة القاعات — تحاكي شكل المكان الفعلي:
//   Social  : 5 طاولات دائرية × 3 كراسي (صفّان من 2 + 1 في الأسفل)
//   Silent  : طاولتا كتابة (4 كراسي لكل منهما: 2+2) + بار دراسة (6 كراسي)
//   Smoking : بار واحد (6 كراسي)
// الألوان (حسب تعليمات المستخدم): مشغول = transparency للـ primary،
// متاح = transparency للـ success. Tooltip: اسم الطالب + المدة المنقضية.
// ============================================================

type Chair = {
  id: string;
  room: string;
  group_label: string;
  seat_number: number;
  occupied: boolean;
  session_id: string | null;
  student_name: string | null;
  check_in: string | null;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function FloorMap() {
  const { t } = useI18n();
  const [chairs, setChairs] = useState<Chair[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // معرّف الجلسة المفتوحة في لوحة التفاصيل (null = مغلقة).
  const [openSession, setOpenSession] = useState<string | null>(null);
  const inFlight = useRef(false);

  // لحظة "الآن" الحية لحساب المدة المنقضية في الـ tooltip بين دورات الـ polling.
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/admin/spaces", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setChairs(data.spots);
        setNow(Date.now());
        setError(null);
      } else {
        setError(data.error ?? t("admin.spaces.loadFail"));
      }
    } catch {
      setError(t("admin.err.network"));
    } finally {
      inFlight.current = false;
    }
  }, [t]);

  usePolling(load, POLL_STANDARD_MS);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // فتح لوحة تفاصيل الجلسة بالضغط على كرسي مشغول.
  const openDetails = useCallback((chair: Chair) => {
    if (chair.session_id) setOpenSession(chair.session_id);
  }, []);

  // بعد إنهاء الجلسة (من اللوحة) نغلقها ونجلب الخريطة فوراً.
  const handleEnded = useCallback(
    (sessionId: string) => {
      setOpenSession((cur) => (cur === sessionId ? null : cur));
      load();
    },
    [load]
  );

  if (chairs === null) {
    return <SkeletonLines rows={4} />;
  }

  const byRoom = (room: string) => chairs.filter((c) => c.room === room);
  const group = (room: string) => {
    const map = new Map<string, Chair[]>();
    for (const c of byRoom(room)) {
      const list = map.get(c.group_label) ?? [];
      list.push(c);
      map.set(c.group_label, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };
  const count = (room: string) => byRoom(room).filter((c) => c.occupied).length;

  const social = group("social");
  // ترتيب المستخدم: 2 أعلى، 2 نص، 1 أسفل.
  const socialRows: string[][] = [];
  if (social.length === 5) {
    socialRows.push([social[0][0], social[1][0]]);
    socialRows.push([social[2][0], social[3][0]]);
    socialRows.push([social[4][0]]);
  } else {
    for (let i = 0; i < social.length; i += 2) {
      socialRows.push(
        social.slice(i, i + 2).map(([label]) => label)
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-3">
        <span className="badge badge-live">
          <span className="pulse-dot" />
          {t("admin.map.live")}
        </span>
        <span className="text-sm text-muted">
          {t("admin.map.sub")}
        </span>
      </div>

      <RoomPanel
        title="Social"
        occupied={count("social")}
        total={byRoom("social").length}
      >
        <div className="flex flex-col gap-5">
          {socialRows.map((row, ri) => (
            <div
              key={ri}
              className={
                row.length === 1
                  ? "flex justify-center"
                  : "flex items-start justify-center gap-6 sm:gap-10"
              }
            >
              {row.map((label) => (
                <RoundTable
                  key={label}
                  label={label}
                  chairs={groupOf(social, label)}
                  now={now}
                  onSelect={openDetails}
                />
              ))}
            </div>
          ))}
        </div>
      </RoomPanel>

      <RoomPanel
        title="Silent"
        occupied={count("silent")}
        total={byRoom("silent").length}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10">
            {group("silent")
              .filter(([label]) => label.startsWith("Silent - Writing"))
              .map(([label, list]) => (
                <WritingTable
                  key={label}
                  label={label}
                  chairs={list}
                  now={now}
                  onSelect={openDetails}
                />
              ))}
          </div>
          <BarGroup
            label="Silent - Study Bar"
            chairs={groupOf(group("silent"), "Silent - Study Bar")}
            now={now}
            onSelect={openDetails}
          />
        </div>
      </RoomPanel>

      <RoomPanel
        title="Smoking Area"
        occupied={count("smoking")}
        total={byRoom("smoking").length}
      >
        <BarGroup
          label="Smoking - Bar"
          chairs={groupOf(group("smoking"), "Smoking - Bar")}
          now={now}
          onSelect={openDetails}
        />
      </RoomPanel>

      <div className="map-legend">
        <span className="flex items-center gap-2">
          <span className="map-seat-free" /> {t("admin.map.free")}
        </span>
        <span className="flex items-center gap-2">
          <span className="map-seat-occupied" /> {t("admin.map.occupied")}
        </span>
        <span className="ms-auto text-xs text-muted">{t("admin.map.tapHint")}</span>
      </div>

      {openSession && (
        <SessionDetailPanel
          sessionId={openSession}
          onClose={() => setOpenSession(null)}
          onEnded={handleEnded}
        />
      )}
    </div>
  );
}

function groupOf(list: [string, Chair[]][], label: string): Chair[] {
  return list.find(([l]) => l === label)?.[1] ?? [];
}

function RoomPanel({
  title,
  occupied,
  total,
  children,
}: {
  title: string;
  occupied: number;
  total: number;
  children: React.ReactNode;
}) {
  const { t, tw } = useI18n();
  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="admin-section-title mb-0">{title}</h2>
        <span className="price-chip tabular-nums">
          {tw("admin.map.occupiedSummary", { occupied, total })}
        </span>
      </div>
      {total === 0 ? (
        <EmptyState title={t("admin.map.emptySeats")} hint={t("admin.map.emptySeatsHint")} />
      ) : (
        children
      )}
    </section>
  );
}

function TableLabel({ label }: { label: string }) {
  return (
    <span className="map-table-label" title={label}>
      {label.replace(/^(Social|Silent|Smoking)\s*-\s*/, "")}
    </span>
  );
}

function RoundTable({
  label,
  chairs,
  now,
  onSelect,
}: {
  label: string;
  chairs: Chair[];
  now: number;
  onSelect: (chair: Chair) => void;
}) {
  const seat = (i: number) => chairs[i];
  return (
    <div className="map-round-table">
      <div className="map-seat-row">
        <ChairDot chair={seat(0)} now={now} onSelect={onSelect} />
        <ChairDot chair={seat(1)} now={now} onSelect={onSelect} />
      </div>
      <TableLabel label={label} />
      <div className="map-seat-row">
        <ChairDot chair={seat(2)} now={now} onSelect={onSelect} />
      </div>
    </div>
  );
}

function WritingTable({
  label,
  chairs,
  now,
  onSelect,
}: {
  label: string;
  chairs: Chair[];
  now: number;
  onSelect: (chair: Chair) => void;
}) {
  // 4 كراسي: 2 فوق و2 تحت (هيئة طاولة كتابة).
  return (
    <div className="map-write-table">
      <div className="map-seat-row">
        <ChairDot chair={chairs[0]} now={now} onSelect={onSelect} />
        <ChairDot chair={chairs[1]} now={now} onSelect={onSelect} />
      </div>
      <TableLabel label={label} />
      <div className="map-seat-row">
        <ChairDot chair={chairs[2]} now={now} onSelect={onSelect} />
        <ChairDot chair={chairs[3]} now={now} onSelect={onSelect} />
      </div>
    </div>
  );
}

function BarGroup({
  label,
  chairs,
  now,
  onSelect,
}: {
  label: string;
  chairs: Chair[];
  now: number;
  onSelect: (chair: Chair) => void;
}) {
  return (
    <div className="map-bar-group">
      <div className="map-seat-row">
        {chairs.map((c) => (
          <ChairDot key={c.id} chair={c} now={now} onSelect={onSelect} />
        ))}
      </div>
      <TableLabel label={label} />
    </div>
  );
}

function ChairDot({
  chair,
  now,
  onSelect,
}: {
  chair: Chair | undefined;
  now: number;
  onSelect: (chair: Chair) => void;
}) {
  const { t } = useI18n();
  const [tipOpen, setTipOpen] = useState(false);

  if (!chair) return <span className="map-seat-slot" aria-hidden="true" />;

  const occupied = chair.occupied;
  const elapsedMs = occupied && chair.check_in
    ? now - new Date(chair.check_in).getTime()
    : 0;
  const person = occupied ? chair.student_name ?? t("admin.map.studentFallback") : t("admin.map.freeSeat");
  const detail = occupied ? formatElapsed(elapsedMs) : "";

  return (
    <span
      className={`map-seat-wrap${occupied ? " map-seat-active" : ""}`}
      onMouseEnter={() => setTipOpen(true)}
      onMouseLeave={() => setTipOpen(false)}
      onClick={() => {
        setTipOpen((v) => !v);
        if (occupied) onSelect(chair);
      }}
    >
      <span
        className={`map-seat ${occupied ? "map-seat-occupied" : "map-seat-free"}`}
        aria-hidden="true"
      />
      {tipOpen && (
        <span className="map-seat-tip">
          <span className="block font-semibold">{person}</span>
          <span className="block">{detail}</span>
          {occupied && (
            <span className="map-seat-tip-cta">
              {t("admin.map.tapHintShort")}
            </span>
          )}
        </span>
      )}
    </span>
  );
}