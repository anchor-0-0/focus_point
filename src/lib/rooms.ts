// ============================================================
// القاعات — المرجع الموحّد لأسماء وبيانات القاعات الثلاث.
// يُستخدم في صفحات الطالب ولوحة المدير معاً.
// ============================================================

export const ROOM_IDS = ["social", "silent", "smoking"] as const;

export type RoomId = (typeof ROOM_IDS)[number];

export type RoomInfo = {
  id: RoomId;
  /** الاسم المعروض (إنجليزي، يطابق الـ labels في الـ seed) */
  name: string;
  /** الوصف المختصر بالقاعة */
  tagline: string;
  /** وصف تفصيلي موجز */
  description: string;
};

export const ROOMS: Record<RoomId, RoomInfo> = {
  social: {
    id: "social",
    name: "Social",
    tagline: "القاعة الاجتماعية",
    description: "5 طاولات دائرية للجلوس مع أصدقائك",
  },
  silent: {
    id: "silent",
    name: "Silent",
    tagline: "قاعة صامتة تماماً",
    description: "بلا موسيقى — مخصصة للكتابة والدراسة",
  },
  smoking: {
    id: "smoking",
    name: "Smoking Area",
    tagline: "منطقة التدخين",
    description: "بار مخصص لمن يرغب بالتدخين",
  },
};

/** اسم قاعة من مفتاح خام (قد يكون null من قاعدة البيانات). */
export function roomName(room: string | null | undefined): string {
  if (room && room in ROOMS) return ROOMS[room as RoomId].name;
  return room ?? "—";
}

/**
 * يحوّل قيمة `room` الخام من قاعدة البيانات إلى مفتاح RoomId.
 * القاعدة تخزّن المفاتيح ('social' | 'silent' | 'smoking')، لكن نتحمّل
 * الأسماء العرضية ("Social", "Smoking Area") واختلاف حالة الأحرف.
 */
export function roomIdOf(room: string | null | undefined): RoomId | null {
  if (!room) return null;
  const key = room.trim().toLowerCase();
  if (key in ROOMS) return key as RoomId;
  if (key.startsWith("smok")) return "smoking";
  if (key.startsWith("silent") || key.startsWith("quiet")) return "silent";
  if (key.startsWith("social")) return "social";
  return null;
}

/**
 * مجموعة التخصيص كما تُعرض للطالب، مُفسَّرة من تسمية قاعدة البيانات
 * ("Social - Table 3") بدل عرضها كما هي (إنجليزية داخل واجهة عربية).
 */
export type SpotGroupLabel =
  | { kind: "table"; table: number | null }
  | { kind: "writingTable"; table: string | null }
  | { kind: "studyBar" }
  | { kind: "smokingBar" };

/** يفسّر `group_label` المخزّنة في قاعدة البيانات إلى وصف مقروء للطالب. */
export function spotGroupOf(
  groupLabel: string | null | undefined
): SpotGroupLabel | null {
  const label = groupLabel?.trim();
  if (!label) return null;
  const lower = label.toLowerCase();

  if (lower.includes("writing")) {
    const m = lower.match(/writing table\s*([a-z])/);
    return { kind: "writingTable", table: m?.[1]?.toUpperCase() ?? null };
  }
  if (lower.includes("study bar")) return { kind: "studyBar" };
  if (lower.includes("smoking")) return { kind: "smokingBar" };
  const table = lower.match(/table\s*(\d+)/);
  if (table) return { kind: "table", table: Number(table[1]) };
  return null;
}

/** تسمية كرسي كاملة: "Social - Table 1 • مقعد 3". */
export function seatLabel(
  groupLabel: string | null | undefined,
  seatNumber: number | null | undefined
): string {
  const group = groupLabel ?? "—";
  if (seatNumber === null || seatNumber === undefined) return group;
  return `${group} • مقعد ${seatNumber}`;
}

// ────────────────────────────────────────────────────────────
// مجموعات التخصيص الدقيقة (تطابق قيم عمود seat_group في القاعدة):
//   social_table   → كل كراسي Social
//   silent_writing → طاولتا الكتابة الكبيرتان في Silent
//   silent_bar     → البار الدراسي في Silent
//   smoking_bar    → كل كراسي Smoking
// ────────────────────────────────────────────────────────────
export const SEAT_GROUPS = [
  "social_table",
  "silent_writing",
  "silent_bar",
  "smoking_bar",
] as const;

export type SeatGroup = (typeof SEAT_GROUPS)[number];

/** القاعة التي ينتمي إليها كل seat_group. */
export const SEAT_GROUP_ROOM: Record<SeatGroup, RoomId> = {
  social_table: "social",
  silent_writing: "silent",
  silent_bar: "silent",
  smoking_bar: "smoking",
};

/** تسمية عرض قصيرة لكل مجموعة تخصيص. */
export const SEAT_GROUP_LABEL: Record<SeatGroup, string> = {
  social_table: "طاولات Social",
  silent_writing: "طاولات الكتابة",
  silent_bar: "بار الدراسة",
  smoking_bar: "بار التدخين",
};

/** سؤال الهدف في قاعة Silent: يقرر من أي مجموعة يُخصَّص الكرسي. */
export type SilentGoal = {
  seatGroup: Extract<SeatGroup, "silent_writing" | "silent_bar">;
  title: string;
  hint: string;
};

export const SILENT_GOALS: SilentGoal[] = [
  {
    seatGroup: "silent_writing",
    title: "قراءة، كتابة، أو مع صديق",
    hint: "طاولات الكتابة الكبيرة",
  },
  {
    seatGroup: "silent_bar",
    title: "لحالي وبستخدم لابتوب",
    hint: "البار الدراسي",
  },
];