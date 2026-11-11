"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandHeader } from "@/components/BrandHeader";
import { useLiveElapsed } from "@/hooks/useLiveElapsed";
import { useSessionWatcher } from "@/hooks/useSessionWatcher";
import { useI18n } from "@/components/LanguageProvider";
import {
  roomIdOf,
  spotGroupOf,
  type RoomId,
  type SpotGroupLabel,
} from "@/lib/rooms";

type SessionClientProps = {
  sessionId: string;
  checkInIso: string | null;
  serverNowIso: string;
  room: string | null;
  groupLabel: string | null;
  seatNumber: number | null;
};

const ROOM_NAME_KEY: Record<RoomId, string> = {
  social: "session.roomName.social",
  silent: "session.roomName.silent",
  smoking: "session.roomName.smoking",
};

type TFn = ReturnType<typeof useI18n>["t"];

/** تسمية المجموعة كما تُعرض للطالب، مترجمة من تسمية قاعدة البيانات. */
function groupTextOf(group: SpotGroupLabel | null, t: TFn): string {
  switch (group?.kind) {
    case "table":
      return group.table
        ? `${t("session.spot.table")} ${group.table}`
        : t("session.spot.table");
    case "writingTable":
      return group.table
        ? `${t("session.spot.writingTable")} ${group.table}`
        : t("session.spot.writingTable");
    case "studyBar":
      return t("session.spot.studyBar");
    case "smokingBar":
      return t("session.spot.smokingBar");
    default:
      return t("session.roomPrefix");
  }
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function SessionClient({
  sessionId,
  checkInIso,
  serverNowIso,
  room,
  groupLabel,
  seatNumber,
}: SessionClientProps) {
  const router = useRouter();
  const { t } = useI18n();

  const [activeCheckIn, setActiveCheckIn] = useState<string | null>(checkInIso);
  const [activeRoom, setActiveRoom] = useState<string | null>(room);
  const [activeGroupLabel, setActiveGroupLabel] = useState<string | null>(groupLabel);
  const [activeSeatNumber, setActiveSeatNumber] = useState<number | null>(seatNumber);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("demo_session_info");
      if (raw) {
        const info = JSON.parse(raw);
        if (info.checkInIso) setActiveCheckIn(info.checkInIso);
        if (info.room) setActiveRoom(info.room);
        if (info.groupLabel) setActiveGroupLabel(info.groupLabel);
        if (info.seatNumber !== undefined) setActiveSeatNumber(info.seatNumber);
      } else if (sessionId === "demo") {
        const nowIso = new Date().toISOString();
        localStorage.setItem(
          "demo_session_info",
          JSON.stringify({
            checkInIso: nowIso,
            room: "silent",
            groupLabel: "القاعة الصامتة",
            seatNumber: 7,
          })
        );
        setActiveCheckIn(nowIso);
      }
    } catch {}
  }, [sessionId]);

  // العدّاد يُحسب من وقت الدخول المُسجّل فعلياً للطالب ويبدأ بالعد تصاعدياً
  const { elapsedMs, recalibrate } = useLiveElapsed(activeCheckIn, serverNowIso);

  // ============================================================
  // مراقبة حالة الجلسة: تصحيح العدّاد من موقّت الخادم الطازج، وعند
  // إنهاء الإدارة جلستنا (status=ended أو 404) ننتقل فوراً إلى واجهة
  // "شكراً لزيارتك" — أينما كنا: هذه الصفحة أو صفحة الخدمات.
  // ============================================================
  useSessionWatcher({
    sessionId,
    onServerNow: recalibrate,
    onEnded: () => {
      router.replace(`/session/${sessionId}/ended`);
    },
  });

  // اسم القاعة كما تُعرض للطالب (لا الاسم التقني من قاعدة البيانات).
  const roomId = roomIdOf(activeRoom);
  const roomText = roomId ? t(ROOM_NAME_KEY[roomId]) : t("session.roomPrefix");

  // المقعد: نترجم تسمية المجموعة المحفوظة في قاعدة البيانات
  // ("Silent - Study Bar") إلى وصف مفهوم ("البار الدراسي · مقعد 3").
  const groupText = groupTextOf(spotGroupOf(activeGroupLabel), t);
  const badge =
    activeSeatNumber === null || activeSeatNumber === undefined
      ? groupText
      : `${groupText} • ${t("session.spot.seat")} ${activeSeatNumber}`;

  return (
    <main className="page">
      <BrandHeader />

      <div className="w-full max-w-md animate-fade-in-up">
        <p className="mb-4 flex items-center justify-center gap-2 text-sm font-semibold text-primary">
          <span className="live-dot-green" aria-hidden="true" />
          {t("session.active")}
        </p>

        {/* بطاقة العدّاد — الشارة توضّح مكان الطالب في القاعة */}
        <div className="timer-hero">
          <p className="timer-label">{t("session.duration")}</p>
          <p key={elapsedMs} className="timer-value mt-2" dir="ltr">
            {formatElapsed(elapsedMs)}
          </p>
          <span className="spot-badge mt-4">{badge}</span>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          {roomText} • {t("session.roomNote")}
        </p>

        <button
          type="button"
          className="btn btn-primary mt-8 w-full"
          onClick={() => router.replace(`/session/${sessionId}/services`)}
        >
          {t("session.requestService")}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ transform: "scaleX(-1)" }}
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>

        <button
          type="button"
          className="btn btn-secondary mt-3 w-full"
          onClick={() => router.replace(`/session/${sessionId}/ended`)}
        >
          {t("ended.title") || "إنهاء الجلسة والحساب"}
        </button>
      </div>
    </main>
  );
}
