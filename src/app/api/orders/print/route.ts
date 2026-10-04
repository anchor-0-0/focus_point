import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-error";
import {
  MAX_FILE_MB,
  ALLOWED_TYPES_UI,
  saveUploadedFile,
} from "@/lib/uploads";
import {
  PRINT_TYPE_LABELS,
  type OrderDetails,
  type PrintMode,
  type PrintOrientation,
  type PrintType,
  type PaperSize,
} from "@/lib/orders";
import { enforceBodyLimit, MAX_PRINT_BODY_BYTES } from "@/lib/body-limit";
import { checkRateLimit, checkWeightedRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getStudentSessionCookie } from "@/lib/student-session";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRINT_SERVICE_NAMES: Record<PrintType, string> = {
  black_white: "طباعة أبيض وأسود",
  color: "طباعة ملونة",
};

// حصة الرفع لكل جلسة في الساعة: 20 ملفاً وبحد أقصى 50MB إجمالي —
// يمنع ملء القرص دفعة واحدة أو عبر حلقات رفع متتالية.
const PRINT_SESSION_LIMITS = {
  maxCount: 20,
  maxBytes: 50 * 1024 * 1024,
  windowMs: 60 * 60_000,
};

export async function POST(request: Request) {
  // حد مبكر لحجم الجسم قبل request.formData() (فكّ ترميز multipart كامل).
  const tooLarge = enforceBodyLimit(request, MAX_PRINT_BODY_BYTES);
  if (tooLarge) return tooLarge;

  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, error: "يُتوقع إرسال الطلب على هيئة multipart/form-data" },
      { status: 400 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "بيانات الطلب غير صحيحة" },
      { status: 400 }
    );
  }

  const sessionId = (form.get("session_id") as string | null)?.trim() ?? "";
  const printType = (form.get("print_type") as string | null)?.trim() ?? "";
  const copiesRaw = (form.get("copies") as string | null)?.trim() ?? "";
  const paper = (form.get("paper") as string | null)?.trim() ?? "";
  const printMode = (form.get("print_mode") as string | null)?.trim() ?? "";
  const orientation = (form.get("orientation") as string | null)?.trim() ?? "";
  const noteRaw = (form.get("note") as string | null)?.trim() ?? "";
  const file = form.get("file");

  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json(
      { ok: false, error: "session_id مطلوب بصيغة صحيحة" },
      { status: 400 }
    );
  }

  if (printType !== "black_white" && printType !== "color") {
    return NextResponse.json(
      { ok: false, error: "type الطباعة يجب أن يكون أبيض وأسود أو ملوّن" },
      { status: 400 }
    );
  }

  const copies = Number(copiesRaw);
  if (!Number.isInteger(copies) || copies <= 0 || copies > 4) {
    return NextResponse.json(
      { ok: false, error: "عدد النسخ يجب أن يكون بين 1 و 4" },
      { status: 400 }
    );
  }

  if (paper !== "a4" && paper !== "booklet") {
    return NextResponse.json(
      { ok: false, error: "نوع الورق يجب أن يكون A4 أو Booklet" },
      { status: 400 }
    );
  }

  if (printMode !== "single_side" && printMode !== "double_side") {
    return NextResponse.json(
      { ok: false, error: "طريقة الطباعة يجب أن تكون وجه واحد أو وجهين" },
      { status: 400 }
    );
  }

  if (orientation !== "portrait" && orientation !== "landscape") {
    return NextResponse.json(
      { ok: false, error: "الاتجاه يجب أن يكون عمودي أو أفقي" },
      { status: 400 }
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "ملف غير مرفوع" },
      { status: 400 }
    );
  }

  try {
    // ============================================================
    // الصلاحيات تقرّر يدوياً (لا RLS): الجلسة موجودة ونشطة.
    // ============================================================
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "الجلسة غير موجودة" },
        { status: 404 }
      );
    }

    if (session.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "انتهت الجلسة، لا يمكن إرسال طلبات جديدة" },
        { status: 409 }
      );
    }

    // ربط الجلسة بجهاز الطالب (A5): لا يُقبل رفع باسم جلسة لم يثبت
    // صاحبها هويته لها عبر الكوكي.
    const boundSessionId = await getStudentSessionCookie();
    if (boundSessionId !== sessionId) {
      return NextResponse.json(
        {
          ok: false,
          error: "جلسة غير موثوقة، الرجاء تسجيل الدخول من جديد",
          untrusted_session: true,
        },
        { status: 403 }
      );
    }

    // حواجز معدل على الرفع: 50MB كحصة تجميعية (بايت + عدد) لكل جلسة
    // في الساعة — يُفحص قبل الكتابة على القرص، إضافةً لمقياس عام.
    const budgetLimiter = checkWeightedRateLimit(
      `print:${sessionId}`,
      PRINT_SESSION_LIMITS,
      file.size
    );
    if (!budgetLimiter.allowed) {
      return rateLimitResponse(
        budgetLimiter.retryAfterMs,
        "تجاوزت حصة رفع الطباعة لهذه الجلسة (20 ملفاً أو 50MB في الساعة)"
      );
    }
    const printGlobalLimiter = checkRateLimit("print:global", 30, 60_000);
    if (!printGlobalLimiter.allowed) {
      return rateLimitResponse(
        printGlobalLimiter.retryAfterMs,
        "طلبات الطباعة كثيرة حالياً، انتظر قليلاً ثم أعد المحاولة"
      );
    }

    // تُختار الخدمة داخلياً حسب type الطباعة ليبقى السعر في مكانه
    // (أبيض وأسود 500 / ملوّن 1500) دون الحاجة لبطاقتين للطالب.
    const serviceName = PRINT_SERVICE_NAMES[printType as PrintType];
    const service = await prisma.service.findFirst({
      where: { name: serviceName },
    });

    if (!service) {
      return NextResponse.json(
        { ok: false, error: `خدمة "${serviceName}" غير موجودة في القائمة` },
        { status: 404 }
      );
    }

    // حفظ الملف أولاً (قد يرفض: نوع أو حجم غير مسموح).
    let saved: Awaited<ReturnType<typeof saveUploadedFile>>;
    try {
      saved = await saveUploadedFile(file);
    } catch (uploadErr) {
      const message =
        uploadErr instanceof Error
          ? uploadErr.message
          : "تعذّر حفظ الملف المرفوع";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    const details: OrderDetails = {
      file_name: saved.originalName,
      file_path: saved.storedName,
      file_type: saved.mime,
      file_size: saved.size,
      print_type: printType as PrintType,
      copies,
      paper: paper as PaperSize,
      print_mode: printMode as PrintMode,
      orientation: orientation as PrintOrientation,
    };
    if (noteRaw !== "") details.note = noteRaw;

    const order = await prisma.order.create({
      data: {
        sessionId,
        serviceId: service.id,
        status: "pending",
        details: details as object,
      },
    });

    return NextResponse.json({
      ok: true,
      order_id: order.id,
      print: PRINT_TYPE_LABELS[printType as PrintType],
      max_mb: MAX_FILE_MB,
      allowed: ALLOWED_TYPES_UI,
    });
  } catch (err) {
    return jsonError(
      "orders-print",
      err,
      500,
      "تعذّر إرسال طلب الطباعة، الرجاء المحاولة مرة أخرى"
    );
  }
}