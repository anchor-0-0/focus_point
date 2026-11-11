"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/Toast";

// ============================================================
// محاكي الخادم الشامل — Focus Point Demo Mock Server
// ------------------------------------------------------------
// يعترض استدعاءات window.fetch في المتصفح لجميع مسارات /api/...
// ويوفّر بيانات واقعية متكاملة لجميع شاشات الطالب ولوحة الأدمن،
// متضمنة إحصائيات الداشبورد، خريطة الـ 35 كرسياً، الطلبات،
// الجلسات، الضيافة، قاعة التدريب، والتقارير المالية.
// ============================================================

export function DemoMockClient() {
  const { showToast } = useToast();
  const toastRef = useRef(showToast);
  toastRef.current = showToast;

  useEffect(() => {
    const isDemo =
      process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
      (typeof window !== "undefined" &&
        (window.location.hostname.includes("github.io") ||
          window.location.pathname.startsWith("/focus_point")));

    if (!isDemo) return;

    const originalFetch = window.fetch;

    window.fetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const urlStr =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;

      // اعتراض مسارات الـ API فقط
      if (urlStr.includes("/api/")) {
        const urlObj = new URL(urlStr, window.location.origin);
        const path = urlObj.pathname.replace(/^\/focus_point/, "");
        const method = (init?.method ?? "GET").toUpperCase();

        const jsonResponse = (data: unknown, status = 200) => {
          return new Response(JSON.stringify(data), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        };

        // ---------------------------------------------------------
        // 1. تسجيل الطالب (/api/checkin)
        // ---------------------------------------------------------
        if (path.endsWith("/api/checkin")) {
          return jsonResponse({ ok: true, student_id: "demo-student-id" });
        }

        // ---------------------------------------------------------
        // 2. تخصيص المقعد (/api/assign-chair)
        // ---------------------------------------------------------
        if (path.endsWith("/api/assign-chair")) {
          return jsonResponse({
            ok: true,
            session_id: "demo",
            chair_label: "طاولة 2 • مقعد 1",
          });
        }

        // ---------------------------------------------------------
        // 3. حالة الجلسة الحية (/api/session/[id]/status)
        // ---------------------------------------------------------
        if (path.includes("/api/session/") && path.endsWith("/status")) {
          return jsonResponse({
            ok: true,
            status: "active",
            server_now: new Date().toISOString(),
          });
        }

        // ---------------------------------------------------------
        // 4. طلبات الخدمات والمشروبات
        // ---------------------------------------------------------
        if (path.endsWith("/api/orders") && method === "POST") {
          return jsonResponse({ ok: true, order_id: "demo-ord-" + Date.now() });
        }

        // ---------------------------------------------------------
        // 5. طلبات الطباعة
        // ---------------------------------------------------------
        if (path.endsWith("/api/orders/print") && method === "POST") {
          return jsonResponse({ ok: true, order_id: "demo-print-" + Date.now() });
        }

        // ---------------------------------------------------------
        // 6. خريطة الأماكن للأدمن (/api/admin/spaces)
        // ---------------------------------------------------------
        if (path.endsWith("/api/admin/spaces")) {
          return jsonResponse({
            ok: true,
            spots: getMockChairs(),
          });
        }

        // ---------------------------------------------------------
        // 7. إحصائيات لوحة التحكم (/api/admin/stats)
        // ---------------------------------------------------------
        if (path.endsWith("/api/admin/stats")) {
          return jsonResponse({
            ok: true,
            revenue: 285000,
            revenue_services: 95000,
            revenue_sessions: 200000,
            discounts_total: 10000,
            done_count: 18,
            billed_sessions: 12,
            billed_hours_today: 28,
            ended_sessions_today: 12,
            avg_billable_hours: 2.33,
            hours_by_room: {
              social: 14,
              silent: 10,
              smoking: 4,
            },
            occupied_total: 18,
            total_spots: 35,
            occupancy: [
              { room: "social", occupied: 8, total: 16 },
              { room: "silent", occupied: 7, total: 12 },
              { room: "smoking", occupied: 3, total: 7 },
            ],
          });
        }

        // ---------------------------------------------------------
        // 8. الجلسات النشطة للأدمن (/api/admin/sessions)
        // ---------------------------------------------------------
        if (path.endsWith("/api/admin/sessions") && method === "GET") {
          return jsonResponse({
            ok: true,
            sessions: getMockActiveSessions(),
          });
        }

        // تفاصيل جلسة فردية (/api/admin/sessions/[id])
        if (
          path.includes("/api/admin/sessions/") &&
          !path.includes("/history") &&
          method === "GET"
        ) {
          const id = path.split("/").pop();
          return jsonResponse({
            ok: true,
            session: getMockSessionDetail(id || "demo-s1"),
          });
        }

        // سجل الجلسات السابقة (/api/admin/sessions/history)
        if (path.includes("/api/admin/sessions/history")) {
          return jsonResponse({
            ok: true,
            from: urlObj.searchParams.get("from") || "2026-11-01",
            to: urlObj.searchParams.get("to") || "2026-11-07",
            sessions: getMockHistorySessions(),
          });
        }

        // ---------------------------------------------------------
        // 9. قائمة الطلبات الواردة للأدمن (/api/admin/orders)
        // ---------------------------------------------------------
        if (path.endsWith("/api/admin/orders") && method === "GET") {
          return jsonResponse({
            ok: true,
            orders: getMockOrders(),
          });
        }

        if (path.endsWith("/api/admin/orders") && (method === "PUT" || method === "PATCH")) {
          toastRef.current("تم تحديث حالة الطلب تجريبياً.", "success");
          return jsonResponse({ ok: true });
        }

        // ---------------------------------------------------------
        // 10. سجل الضيافة (/api/admin/hospitality)
        // ---------------------------------------------------------
        if (path.endsWith("/api/admin/hospitality") && method === "GET") {
          return jsonResponse(getMockHospitalityData());
        }

        if (path.endsWith("/api/admin/hospitality") && method === "POST") {
          toastRef.current("تم تسجيل الضيافة بنجاح (تجريبي للعرض).", "success");
          return jsonResponse({ ok: true, id: "hosp-demo-" + Date.now() });
        }

        if (path.includes("/api/admin/hospitality/recipients")) {
          return jsonResponse({
            ok: true,
            recipients: [
              { id: "r1", name: "إدارة المركز", type: "management" },
              { id: "r2", name: "د. فراس نعمة (مدرب ورشة)", type: "guest" },
              { id: "r3", name: "أ. ليلى الشام (ضيفة المركز)", type: "guest" },
              { id: "r4", name: "فريق الإشراف الصباحي", type: "management" },
            ],
          });
        }

        // ---------------------------------------------------------
        // 11. قاعة التدريب والدورات (/api/admin/training)
        // ---------------------------------------------------------
        if (path.endsWith("/api/admin/training") && method === "GET") {
          return jsonResponse({
            ok: true,
            courses: getMockTrainingCourses(),
          });
        }

        if (path.endsWith("/api/admin/training") && (method === "POST" || method === "PUT")) {
          toastRef.current("تم حفظ الدورة التدريبية بنجاح (تجريبي للعرض فقط).", "success");
          return jsonResponse({ ok: true, id: "course-demo-" + Date.now() });
        }

        if (path.includes("/api/admin/training/") && method === "DELETE") {
          toastRef.current("تم حذف الدورة التدريبية تجريبياً.", "success");
          return jsonResponse({ ok: true });
        }

        // ---------------------------------------------------------
        // 12. قائمة الخدمات والأسعار (/api/admin/services)
        // ---------------------------------------------------------
        if (path.endsWith("/api/admin/services") && method === "GET") {
          return jsonResponse({
            ok: true,
            services: getMockServices(),
          });
        }

        if (path.endsWith("/api/admin/services") && (method === "POST" || method === "PUT")) {
          toastRef.current("تم تحديث الخدمة بنجاح (تجريبي).", "success");
          return jsonResponse({ ok: true });
        }

        // ---------------------------------------------------------
        // 13. التقارير المالية (/api/admin/report)
        // ---------------------------------------------------------
        if (path.includes("/api/admin/report")) {
          return jsonResponse(getMockReportData());
        }

        // ---------------------------------------------------------
        // 14. إعدادات النظام (/api/admin/settings)
        // ---------------------------------------------------------
        if (path.endsWith("/api/admin/settings")) {
          if (method === "PUT") {
            toastRef.current("تم تحديث سعر الساعة بنجاح (تجريبي للعرض).", "success");
            return jsonResponse({ ok: true });
          }
          return jsonResponse({ ok: true, hourly_rate_syp: 10000 });
        }

        // ---------------------------------------------------------
        // 15. إنهاء الجلسة (/api/admin/end-session)
        // ---------------------------------------------------------
        if (path.endsWith("/api/admin/end-session")) {
          toastRef.current(
            "تمت محاكاة إنهاء الجلسة وإصدار الفاتورة بنجاح!",
            "success"
          );
          return jsonResponse({ ok: true });
        }

        // ---------------------------------------------------------
        // 16. تنظيف الملفات المؤقتة (/api/admin/files/cleanup)
        // ---------------------------------------------------------
        if (path.endsWith("/api/admin/files/cleanup")) {
          return jsonResponse({ ok: true, removed: 0 });
        }

        // ---------------------------------------------------------
        // 17. تسجيل دخول الإدارة (/api/admin/login)
        // ---------------------------------------------------------
        if (path.endsWith("/api/admin/login")) {
          return jsonResponse({ ok: true });
        }

        // ---------------------------------------------------------
        // 18. باركود ومعلومات السيرفر (/api/server-info)
        // ---------------------------------------------------------
        if (path.endsWith("/api/server-info")) {
          const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
          return jsonResponse({
            ok: true,
            interfaces: [
              {
                name: "عرض تجريبي مباشر (Focus Point Demo)",
                ip: "Online Static Demo",
                url: `${window.location.origin}${basePath}/checkin`,
              },
            ],
          });
        }

        // استجابة افتراضية لأي مسار API آخر
        return jsonResponse({ ok: true, message: "Demo mode simulated response" });
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}

// ============================================================
// مولدات البيانات الواقعية للاستعراض التجريبي
// ============================================================

function getMockChairs() {
  const chairs: Array<{
    id: string;
    room: string;
    group_label: string;
    seat_number: number;
    occupied: boolean;
    session_id: string | null;
    student_name: string | null;
    check_in: string | null;
  }> = [];

  const now = Date.now();

  // Social: 5 طاولات × 3 كراسي + 1 مقعد بار = 16 كرسي
  const socialStudents = [
    "نور الهدى العلي",
    "عمر الشامي",
    "سارة قاسم",
    "كريم نجار",
    "مايا كمال",
    "أحمد الدباس",
    "يارا الخطيب",
    "سامر خوري",
  ];
  let sIdx = 0;
  for (let table = 1; table <= 5; table++) {
    for (let seat = 1; seat <= 3; seat++) {
      const isOcc = sIdx < socialStudents.length;
      chairs.push({
        id: `soc-t${table}-s${seat}`,
        room: "social",
        group_label: `Table ${table}`,
        seat_number: seat,
        occupied: isOcc,
        session_id: isOcc ? `demo-s-${table}-${seat}` : null,
        student_name: isOcc ? socialStudents[sIdx] : null,
        check_in: isOcc
          ? new Date(now - (35 + sIdx * 12) * 60 * 1000).toISOString()
          : null,
      });
      if (isOcc) sIdx++;
    }
  }
  chairs.push({
    id: "soc-bar-1",
    room: "social",
    group_label: "Social Bar",
    seat_number: 1,
    occupied: false,
    session_id: null,
    student_name: null,
    check_in: null,
  });

  // Silent: طاولتا كتابة (4 كراسي لكل منهما) + بار دراسي (4 كراسي) = 12 كرسي
  const silentStudents = [
    "طارق المصري",
    "ريم الحلبي",
    "كنان درويش",
    "هدى الصباغ",
    "محمود عثمان",
    "رنا الزين",
    "فادي يوسف",
  ];
  let silIdx = 0;
  ["Writing Table A", "Writing Table B"].forEach((tbl) => {
    for (let seat = 1; seat <= 4; seat++) {
      const isOcc = silIdx < 4 && silIdx < silentStudents.length;
      chairs.push({
        id: `sil-${tbl.replace(/\s+/g, "")}-s${seat}`,
        room: "silent",
        group_label: tbl,
        seat_number: seat,
        occupied: isOcc,
        session_id: isOcc ? `demo-sil-${seat}` : null,
        student_name: isOcc ? silentStudents[silIdx] : null,
        check_in: isOcc
          ? new Date(now - (40 + silIdx * 18) * 60 * 1000).toISOString()
          : null,
      });
      if (isOcc) silIdx++;
    }
  });

  for (let seat = 1; seat <= 4; seat++) {
    const isOcc = silIdx < silentStudents.length;
    chairs.push({
      id: `sil-bar-s${seat}`,
      room: "silent",
      group_label: "Study Bar",
      seat_number: seat,
      occupied: isOcc,
      session_id: isOcc ? `demo-sil-bar-${seat}` : null,
      student_name: isOcc ? silentStudents[silIdx] : null,
      check_in: isOcc
        ? new Date(now - (20 + silIdx * 10) * 60 * 1000).toISOString()
        : null,
    });
    if (isOcc) silIdx++;
  }

  // Smoking: بار واحد (7 كراسي)
  const smokingStudents = ["باسل عواد", "جود مراد", "زياد حيدر"];
  for (let seat = 1; seat <= 7; seat++) {
    const isOcc = seat <= smokingStudents.length;
    chairs.push({
      id: `smk-bar-s${seat}`,
      room: "smoking",
      group_label: "Smoking Bar",
      seat_number: seat,
      occupied: isOcc,
      session_id: isOcc ? `demo-smk-${seat}` : null,
      student_name: isOcc ? smokingStudents[seat - 1] : null,
      check_in: isOcc
        ? new Date(now - (50 + seat * 15) * 60 * 1000).toISOString()
        : null,
    });
  }

  return chairs;
}

function getMockActiveSessions() {
  const now = Date.now();
  return [
    {
      id: "demo-s1",
      student_name: "نور الهدى العلي",
      spot_room: "social",
      spot_group_label: "Table 1",
      spot_seat_number: 1,
      check_in: new Date(now - 85 * 60 * 1000).toISOString(),
      billable_hours: 1.5,
      session_amount: 15000,
    },
    {
      id: "demo-s2",
      student_name: "طارق المصري",
      spot_room: "silent",
      spot_group_label: "Writing Table A",
      spot_seat_number: 2,
      check_in: new Date(now - 130 * 60 * 1000).toISOString(),
      billable_hours: 2.5,
      session_amount: 25000,
    },
    {
      id: "demo-s3",
      student_name: "عمر الشامي",
      spot_room: "social",
      spot_group_label: "Table 2",
      spot_seat_number: 2,
      check_in: new Date(now - 45 * 60 * 1000).toISOString(),
      billable_hours: 1.0,
      session_amount: 10000,
    },
    {
      id: "demo-s4",
      student_name: "ريم الحلبي",
      spot_room: "silent",
      spot_group_label: "Writing Table B",
      spot_seat_number: 1,
      check_in: new Date(now - 170 * 60 * 1000).toISOString(),
      billable_hours: 3.0,
      session_amount: 30000,
    },
    {
      id: "demo-s5",
      student_name: "باسل عواد",
      spot_room: "smoking",
      spot_group_label: "Smoking Bar",
      spot_seat_number: 1,
      check_in: new Date(now - 60 * 60 * 1000).toISOString(),
      billable_hours: 1.0,
      session_amount: 10000,
    },
    {
      id: "demo-s6",
      student_name: "مايا كمال",
      spot_room: "social",
      spot_group_label: "Table 3",
      spot_seat_number: 1,
      check_in: new Date(now - 110 * 60 * 1000).toISOString(),
      billable_hours: 2.0,
      session_amount: 20000,
    },
  ];
}

function getMockSessionDetail(id: string) {
  const now = Date.now();
  return {
    id,
    status: "active",
    check_in: new Date(now - 85 * 60 * 1000).toISOString(),
    student_name: "نور الهدى العلي",
    student_phone: "0944111222",
    spot_room: "social",
    spot_group_label: "Table 1",
    spot_seat_number: 1,
    orders: [
      {
        id: "ord-d-1",
        status: "done",
        service_name: "قهوة أمريكانو",
        created_at: new Date(now - 70 * 60 * 1000).toISOString(),
      },
      {
        id: "ord-d-2",
        status: "pending",
        service_name: "شاي خمير مع نعنع",
        created_at: new Date(now - 10 * 60 * 1000).toISOString(),
      },
    ],
  };
}

function getMockOrders() {
  const now = Date.now();
  return [
    {
      id: "ord-live-1",
      service_name: "شاي خمير مع نعنع",
      price: 1500,
      student_name: "نور الهدى العلي",
      spot_label: "Social • Table 1 • Seat 1",
      created_at: new Date(now - 8 * 60 * 1000).toISOString(),
      details: { quantity: 1, sugar: "medium", note: "نعنع خفيف" },
    },
    {
      id: "ord-live-2",
      service_name: "طباعة أبيض وأسود",
      price: 500,
      student_name: "ريم الحلبي",
      spot_label: "Silent • Writing Table B • Seat 1",
      created_at: new Date(now - 15 * 60 * 1000).toISOString(),
      details: {
        pages: 14,
        copies: 1,
        color_mode: "bw",
        paper_size: "A4",
        note: "تقرير جامعي على وجهين",
      },
    },
    {
      id: "ord-live-3",
      service_name: "قهوة لاتيه",
      price: 3500,
      student_name: "عمر الشامي",
      spot_label: "Social • Table 2 • Seat 2",
      created_at: new Date(now - 3 * 60 * 1000).toISOString(),
      details: { quantity: 1, sugar: "none", note: "حليب قليل الدسم" },
    },
    {
      id: "ord-live-4",
      service_name: "عصير برتقال طبيعي",
      price: 4000,
      student_name: "باسل عواد",
      spot_label: "Smoking • Smoking Bar • Seat 1",
      created_at: new Date(now - 1 * 60 * 1000).toISOString(),
      details: { quantity: 1, note: "طازج بدون ثلج" },
    },
  ];
}

function getMockHistorySessions() {
  const now = Date.now();
  return [
    {
      session_id: "hist-1",
      student_name: "حسام الدين الصالح",
      room: "social",
      group_label: "Table 4",
      seat_number: 2,
      check_in: new Date(now - 5 * 3600 * 1000).toISOString(),
      check_out: new Date(now - 3 * 3600 * 1000).toISOString(),
      actual_duration_ms: 2 * 3600 * 1000,
      billable_hours: 2,
      session_amount: 20000,
      services_total: 5000,
      total: 25000,
      discount_amount: 2500,
      final_total: 22500,
    },
    {
      session_id: "hist-2",
      student_name: "دينا بكور",
      room: "silent",
      group_label: "Study Bar",
      seat_number: 3,
      check_in: new Date(now - 6 * 3600 * 1000).toISOString(),
      check_out: new Date(now - 4 * 3600 * 1000).toISOString(),
      actual_duration_ms: 2 * 3600 * 1000,
      billable_hours: 2,
      session_amount: 20000,
      services_total: 3000,
      total: 23000,
      discount_amount: 0,
      final_total: 23000,
    },
    {
      session_id: "hist-3",
      student_name: "أنس الخراط",
      room: "smoking",
      group_label: "Smoking Bar",
      seat_number: 4,
      check_in: new Date(now - 4 * 3600 * 1000).toISOString(),
      check_out: new Date(now - 2 * 3600 * 1000).toISOString(),
      actual_duration_ms: 2 * 3600 * 1000,
      billable_hours: 2,
      session_amount: 20000,
      services_total: 4500,
      total: 24500,
      discount_amount: 0,
      final_total: 24500,
    },
  ];
}

function getMockHospitalityData() {
  const now = Date.now();
  return {
    ok: true,
    logs: [
      {
        id: "hosp-1",
        created_at: new Date(now - 2 * 3600 * 1000).toISOString(),
        recipient_type: "guest",
        recipient_label: "د. فراس نعمة (مدرب ورشة الذكاء الاصطناعي)",
        recipient_id: "r2",
        guest_label: "د. فراس نعمة",
        guests_count: 2,
        quantity: 2,
        unit_price: 2500,
        estimated_value: 5000,
        service_id: "srv-coffee",
        service_name: "قهوة تركية",
        service_category: "مشروبات",
        note: "ضيافة افتتاح الدورة التدريبية",
      },
      {
        id: "hosp-2",
        created_at: new Date(now - 5 * 3600 * 1000).toISOString(),
        recipient_type: "management",
        recipient_label: "إدارة المركز",
        recipient_id: "r1",
        guest_label: null,
        guests_count: 3,
        quantity: 3,
        unit_price: 1500,
        estimated_value: 4500,
        service_id: "srv-tea",
        service_name: "شاي أخضر",
        service_category: "مشروبات",
        note: "اجتماع تخطيط فعاليات الأسبوع",
      },
    ],
    buckets: {
      guest: {
        logs: 1,
        people: 2,
        quantity: 2,
        services_count: 1,
        estimated_value: 5000,
        by_service: [
          { service_id: "srv-coffee", service_name: "قهوة تركية", quantity: 2, estimated_value: 5000 },
        ],
      },
      management: {
        logs: 1,
        people: 3,
        quantity: 3,
        services_count: 1,
        estimated_value: 4500,
        by_service: [
          { service_id: "srv-tea", service_name: "شاي أخضر", quantity: 3, estimated_value: 4500 },
        ],
      },
    },
    total: {
      logs: 2,
      people: 5,
      quantity: 5,
      services_count: 2,
      estimated_value: 9500,
      by_service: [
        { service_id: "srv-tea", service_name: "شاي أخضر", quantity: 3, estimated_value: 4500 },
        { service_id: "srv-coffee", service_name: "قهوة تركية", quantity: 2, estimated_value: 5000 },
      ],
    },
  };
}

function getMockTrainingCourses() {
  return [
    {
      id: "course-1",
      name: "دورة الرسم الزيتي وتقنيات مزج الألوان",
      code: "ART-2026",
      trainer: "الفنانة ديما الأحمد",
      startDate: "2026-11-01",
      endDate: "2026-11-25",
      startTime: "16:00",
      endTime: "18:30",
      days: ["الأحد", "الثلاثاء", "الخميس"],
      studentsCount: 12,
      sessionsCount: 12,
      totalCost: 1800000,
      costPerStudent: 150000,
      centerSharePercent: 30,
      notes: "القاعة مجهزة بكامل مساند الرسم والمواد الفنية",
      createdAt: "2026-10-25T10:00:00Z",
      updatedAt: "2026-11-01T10:00:00Z",
    },
    {
      id: "course-2",
      name: "ورشة تصميم واجهات وتجربة المستخدم UI/UX",
      code: "UIUX-101",
      trainer: "م. وسيم الصالح",
      startDate: "2026-11-15",
      endDate: "2026-11-30",
      startTime: "17:00",
      endTime: "19:00",
      days: ["السبت", "الإثنين", "الأربعاء"],
      studentsCount: 15,
      sessionsCount: 8,
      totalCost: 2250000,
      costPerStudent: 150000,
      centerSharePercent: 35,
      notes: "تتضمن تطبيقات عملية ومشاريع تخرج حقيقية",
      createdAt: "2026-11-02T12:00:00Z",
      updatedAt: "2026-11-02T12:00:00Z",
    },
    {
      id: "course-3",
      name: "أساسيات الإظهار المعماري الرقمي",
      code: "ARCH-301",
      trainer: "م. كمال الخوري",
      startDate: "2026-10-05",
      endDate: "2026-10-28",
      startTime: "15:00",
      endTime: "17:30",
      days: ["الأحد", "الأربعاء"],
      studentsCount: 10,
      sessionsCount: 8,
      totalCost: 1500000,
      costPerStudent: 150000,
      centerSharePercent: 30,
      notes: "تم تسليم شهادات الحضور بنجاح لجميع المشاركين",
      createdAt: "2026-09-20T10:00:00Z",
      updatedAt: "2026-10-28T18:00:00Z",
    },
  ];
}

function getMockServices() {
  return [
    { id: "s-1", name: "قهوة أمريكانو", category: "مشروبات ساخنة", price: 2500 },
    { id: "s-2", name: "قهوة لاتيه / كابتشينو", category: "مشروبات ساخنة", price: 3500 },
    { id: "s-3", name: "شاي خمير بنكهات", category: "مشروبات ساخنة", price: 1500 },
    { id: "s-4", name: "شاي أخضر وزهورات", category: "مشروبات ساخنة", price: 1500 },
    { id: "s-5", name: "عصير برتقال طبيعي", category: "مشروبات باردة", price: 4000 },
    { id: "s-6", name: "مياه معدنية صغيرة", category: "مشروبات باردة", price: 1000 },
    { id: "s-7", name: "طباعة أبيض وأسود A4", category: "طباعة", price: 500 },
    { id: "s-8", name: "طباعة ملونة A4", category: "طباعة", price: 1500 },
    { id: "s-9", name: "طباعة ملونة A3 مخططات", category: "طباعة", price: 3500 },
  ];
}

function getMockReportData() {
  return {
    ok: true,
    from: "2026-11-01",
    to: "2026-11-07",
    generated_at: new Date().toISOString(),
    summary: {
      students_count: 42,
      sessions_count: 58,
      orders_count: 74,
      done_count: 70,
      pending_count: 4,
      cancelled_count: 0,
      done_revenue: 145000,
      sessions_revenue: 480000,
      services_revenue: 145000,
      discounts_total: 25000,
      revenue: 600000,
      ended_sessions: 52,
      billable_hours: 104,
      avg_billable_hours: 2.0,
      hours_by_room: { social: 56, silent: 34, smoking: 14 },
    },
    students: [],
    orders: [],
    sessions: [],
    services: [
      { name: "شاي خمير بنكهات", category: "مشروبات ساخنة", count: 32, revenue: 48000 },
      { name: "قهوة أمريكانو", category: "مشروبات ساخنة", count: 24, revenue: 60000 },
      { name: "طباعة أبيض وأسود A4", category: "طباعة", count: 14, revenue: 17000 },
      { name: "عصير برتقال طبيعي", category: "مشروبات باردة", count: 8, revenue: 32000 },
    ],
    hospitality: [],
  };
}
