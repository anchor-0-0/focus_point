"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, type CSSProperties } from "react";
import { BrandHeader } from "@/components/BrandHeader";
import { ActiveSessionGuard } from "@/components/ActiveSessionGuard";
import { useI18n } from "@/components/LanguageProvider";
import { setStoredActiveSessionId } from "@/lib/active-session";
import {
  ROOMS,
  SILENT_GOALS,
  SEAT_GROUP_ROOM,
  type RoomId,
  type SeatGroup,
} from "@/lib/rooms";

type PendingAssign = { seatGroup: SeatGroup };

function RoomChoiceContent() {
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("student_id") ?? "";

  // مرحلة داخل الشاشة: اختيار قاعة، ثم (لقاعة Silent) سؤال الهدف، ثم تعيين.
  const [stage, setStage] = useState<"rooms" | "silent-goal">("rooms");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<PendingAssign | null>(null);

  const roomNameKey: Record<RoomId, "room.social.name" | "room.silent.name" | "room.smoking.name"> = {
    social: "room.social.name",
    silent: "room.silent.name",
    smoking: "room.smoking.name",
  };
  const roomDescKey: Record<RoomId, "room.social.desc" | "room.silent.desc" | "room.smoking.desc"> = {
    social: "room.social.desc",
    silent: "room.silent.desc",
    smoking: "room.smoking.desc",
  };

  async function assign(seatGroup: SeatGroup) {
    if (!studentId) {
      setError(t("room.err.noStudent"));
      return;
    }

    setSubmitting({ seatGroup });
    setError(null);

    try {
      const res = await fetch("/api/assign-chair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, seat_group: seatGroup }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error ?? t("room.err.generic"));
        setSubmitting(null);
      } else {
        // بعد نجاح التخصيص: نُخزّن معرف الجلسة فوراً حتى لو أُعيد فتح
        // المتصفح أو ضُغط زر الرجوع، نعلم أنها لا تزال نشطة.
        setStoredActiveSessionId(data.session_id);
        router.replace(`/session/${data.session_id}`);
      }
    } catch {
      setError(t("room.err.network"));
      setSubmitting(null);
    }
  }

  function chooseRoom(room: RoomId) {
    if (room === "silent") {
      setStage("silent-goal");
      return;
    }
    // Social و Smoking: تخصيص مباشر من مجموعتهما دون سؤال إضافي.
    void assign(room === "social" ? "social_table" : "smoking_bar");
  }

  const busy = submitting !== null;

  return (
    <main className="page">
      <BrandHeader variant="large" />
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="screen-header">
          <span className="badge badge-neutral">{t("room.step")}</span>
          <h1 className="screen-title">
            {stage === "rooms" ? t("room.title.rooms") : t("room.title.goal")}
          </h1>
          <p className="screen-sub">
            {stage === "rooms" ? t("room.sub.rooms") : t("room.sub.goal")}
          </p>
        </div>

        <div className="focus-divider" aria-hidden="true">
          <span className="focus-divider-dot" />
        </div>

        {error && <p className="error">{error}</p>}

        {stage === "rooms" ? (
          <div className="flex flex-col gap-4">
            {Object.values(ROOMS).map((room) => {
              // القاعة التي يجري فيها التخصيص حالياً (لعرض "جارٍ التخصيص" عليها).
              const submittingRoom = submitting
                ? SEAT_GROUP_ROOM[submitting.seatGroup]
                : null;
              return (
                <button
                  key={room.id}
                  type="button"
                  className="option-card flex items-center gap-4"
                  onClick={() => chooseRoom(room.id)}
                  disabled={busy}
                >
                  <span className="choice-avatar">
                    <RoomGlyph room={room.id} />
                  </span>
                  <span className="flex-1">
                    <span className="flex items-center gap-2">
                      <span className="block text-lg font-semibold text-foreground">
                        {submittingRoom === room.id
                          ? t("room.assigning")
                          : t(roomNameKey[room.id])}
                      </span>
                      {room.id === "silent" && (
                        <span className="badge badge-live">{t("room.liveBadge")}</span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                      {t(roomDescKey[room.id])}
                    </span>
                  </span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ transform: "scaleX(-1)" }}
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {SILENT_GOALS.map((goal) => {
              const isSubmitting = submitting?.seatGroup === goal.seatGroup;
              const goalTitleKey =
                goal.seatGroup === "silent_writing"
                  ? ("room.goal.writing.title" as const)
                  : ("room.goal.bar.title" as const);
              const goalHintKey =
                goal.seatGroup === "silent_writing"
                  ? ("room.goal.writing.hint" as const)
                  : ("room.goal.bar.hint" as const);
              return (
                <button
                  key={goal.seatGroup}
                  type="button"
                  className="option-card flex items-center gap-4"
                  onClick={() => assign(goal.seatGroup)}
                  disabled={busy}
                >
                  <span className="choice-avatar">
                    <GoalGlyph seatGroup={goal.seatGroup} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-lg font-semibold text-foreground">
                      {isSubmitting ? t("room.assigning") : t(goalTitleKey)}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                      {t(goalHintKey)}
                    </span>
                  </span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ transform: "scaleX(-1)" }}
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              );
            })}

            <button
              type="button"
              className="btn btn-option mt-2 w-full"
              onClick={() => setStage("rooms")}
              disabled={busy}
            >
              {t("room.back")}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function GoalGlyph({
  seatGroup,
}: {
  seatGroup: "silent_writing" | "silent_bar";
}) {
  if (seatGroup === "silent_bar") {
    return (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ display: "block" } as CSSProperties}
      >
        <path d="M4 5h10" />
        <path d="M3 5v8a4 4 0 0 0 4 4h4" />
        <path d="M10 17v3" />
        <path d="M7 20h3" />
      </svg>
    );
  }
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" } as CSSProperties}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function RoomGlyph({ room }: { room: RoomId }) {
  const style = { display: "block" } as CSSProperties;
  if (room === "silent") {
    return (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={style}
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  if (room === "smoking") {
    return (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={style}
      >
        <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
        <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
        <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
      </svg>
    );
  }
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function RoomChoicePage() {
  return (
    <Suspense fallback={null}>
      <ActiveSessionGuard>
        <RoomChoiceContent />
      </ActiveSessionGuard>
    </Suspense>
  );
}