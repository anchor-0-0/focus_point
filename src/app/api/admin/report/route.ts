import { NextRequest, NextResponse } from "next/server";
import { requireAdminJson } from "@/lib/admin-require";
import {
  damascusToday,
  damascusDayBoundaries,
  fetchReport,
  buildReportWorkbook,
} from "@/lib/report";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/admin/report?from=YYYY-MM-DD&to=YYYY-MM-DD[&format=xlsx]
 *   - تقرير الفترة كـ JSON (للواجهة)
 *   - format=xlsx → تحميل مصنف Excel منسق (نسخة للقراءة فقط من
 *     قاعدة البيانات المحلية؛ البيانات تبقى في القاعدة الأصلية).
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from")?.trim() ?? "";
    const toParam = url.searchParams.get("to")?.trim() ?? "";
    const format = url.searchParams.get("format")?.trim() ?? "json";

    // الفترة الافتراضية = اليوم بمنطقة دمشق عند غياب التواريخ.
    let from = fromParam;
    let to = toParam;
    if (!from && !to) {
      from = to = damascusToday();
    } else if (from && !to) {
      to = from;
    } else if (!from && to) {
      from = to;
    }

    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "التاريخ بصيغة خاطئة — المطلوب YYYY-MM-DD (مثال: 2026-09-25)",
        },
        { status: 400 }
      );
    }
    if (from > to) [from, to] = [to, from];

    const { fromDate, toDate } = damascusDayBoundaries(from, to);
    const report = await fetchReport(fromDate, toDate, from, to);

    if (format === "xlsx") {
      const buf = await buildReportWorkbook(report);
      // اسم الملف يتضمن التاريخ: يوم واحد → focus-point-report-2026-10-05.xlsx،
      // فترة → focus-point-report-2026-10-05-to-2026-10-07.xlsx.
      const filename =
        from === to
          ? `focus-point-report-${from}.xlsx`
          : `focus-point-report-${from}-to-${to}.xlsx`;
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${filename}`,
        },
      });
    }

    return NextResponse.json({ ok: true, ...report });
  } catch (error) {
    console.error("[admin-report] فشل توليد التقرير:", error);
    return NextResponse.json(
      { ok: false, error: "تعذّر توليد التقرير، حاول مجدداً" },
      { status: 500 }
    );
  }
}