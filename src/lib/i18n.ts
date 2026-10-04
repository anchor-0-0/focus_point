// ============================================================
// نظام اللغة (عربي/إنجليزي) — قاموس مركزي + أدوات اختيار النص.
// ------------------------------------------------------------
// - اللغة الافتراضية عربية؛ المفتاح يُحفظ في كوكي «fp_lang» ليقرأه
//   الخادوم (لتوجيه RTL/LTR والاختيار عند التصيير) وليُقرأه العميل
//   عند أول تحميل للصفحة لتجنّب وميض اللغة الخاطئة.
// - كل قيمة قاموس هي { ar, en }؛ translate() يُرجع النص المناسب
//   للغة الحالية، ويعيد العربية عند غياب المفتاح (fallback آمن).
// - تُعرَّف كل السلاسل في هذا الملف حصراً — لا توجد سلاسل مبعثرة.
// ============================================================

export type Lang = "ar" | "en";

export const LANG_COOKIE = "fp_lang";
export const DEFAULT_LANG: Lang = "ar";

/** إدخال قاموس ثنائي: النص العربي والنص الإنجليزي. */
export type DictEntry = { ar: string; en: string };

/** مفتاح ناموس أو إدخال قاموس مباشرةً (لتسهيل تمرير السلاسل الجاهزة). */
export type MaybeEntry = string | DictEntry | undefined | null;

/** القاموس المركزي — كل واجهات الطالب والإدارة هنا. */
export const dict = {
  // ─── الشعار / السبلاش ────────────────────────────────
  "splash.aria": { ar: "أهلاً بك في Focus Point — انقر لتُحجز لك لحظة هدوء", en: "Welcome to Focus Point — tap to reserve a moment of calm" },
  "splash.tagline": { ar: "مساحةٌ صُنعت للهدوء: إضاءةٌ ناعمة، طاولاتٌ مختارة بعناية، وضيافةٌ تحفظ لك تركيزك حتى آخر دقيقة.", en: "A space crafted for calm: soft light, thoughtfully chosen tables, and hospitality that protects your focus to the last minute." },
  "brand.tagline": { ar: "مساحتك الهادئة للدراسة والإبداع — هنا يمرّ الوقت بسلام", en: "Your quiet space for study and creativity — where time passes in peace" },
  "brand.changeLang": { ar: "تغيير اللغة", en: "Change language" },

  // ─── مشترك ───────────────────────────────────────────────
  "meta.description": { ar: "مساحة دراسة هادئة (طاولات) ومراسم فنية (استوديو) — اختر مكانك وابدأ جلستك.", en: "A quiet study space (desks) and art studios — pick your spot and start your session." },
  "common.loading": { ar: "جارٍ التحميل", en: "Loading" },
  "common.close": { ar: "إغلاق", en: "Close" },
  "common.cancel": { ar: "إلغاء", en: "Cancel" },
  "guard.checking": { ar: "نُجهّئ مقعدك ونضبط لك الأضواء…", en: "Preparing your seat and adjusting the lights…" },

  // ─── التسجيل (checkin) ───────────────────────────────
  "checkin.step": { ar: "خطوة ١ من ٢", en: "Step 1 of 2" },
  "checkin.title": { ar: "لنبدأ بتعرّفٍ يليق بك", en: "Let's begin with an introduction worthy of you" },
  "checkin.sub": { ar: "لا تسجيلَ ولا بطاقاتَ ولا انتظار — اسمك وحده يكفي لنحجز لك أجمل كرسيٍّ في المكان.", en: "No sign-ups, no cards, no waiting — your name alone is enough to reserve you the finest seat in the house." },
  "checkin.name.label": { ar: "الاسم", en: "Full name" },
  "checkin.name.placeholder": { ar: "اكتب اسمك الكامل", en: "Enter your full name" },
  "checkin.name.hint": { ar: "حتى 20 حرفاً — اكتبه كما تحبّ أن نناديك", en: "Up to 20 characters — write it the way you'd like to be greeted" },
  "checkin.phone.label": { ar: "رقم الهاتف *", en: "Phone number *" },
  "checkin.phone.placeholder": { ar: "أرقام فقط (مثال: 0944444444)", en: "Digits only (e.g. 0944444444)" },
  "checkin.phone.hint": { ar: "أرقام فقط — نحفظها لخدمتك خلال الزيارة فقط", en: "Digits only — we keep it to serve you during this visit only" },
  "checkin.err.name": { ar: "الاسم مطلوب", en: "Name is required" },
  "checkin.err.phone": { ar: "رقم الهاتف مطلوب — أرقام فقط (من ٧ إلى ١٥ رقماً)", en: "Phone required — digits only (7 to 15 digits)" },
  "checkin.err.generic": { ar: "حدث خطأ ما", en: "Something went wrong" },
  "checkin.err.network": { ar: "حدث خطأ في الاتصال", en: "Connection error" },
  "checkin.submit": { ar: "تابع إلى القاعات", en: "Continue to the rooms" },
  "checkin.submitting": { ar: "نُحضّر مقعدك...", en: "Preparing your seat…" },

  // ─── اختيار القاعة (checkin/room) ────────────────────
  "room.step": { ar: "خطوة ٢ من ٢", en: "Step 2 of 2" },
  "room.title.rooms": { ar: "أيّ ركنٍ يناديك اليوم؟", en: "Which corner calls you today?" },
  "room.title.goal": { ar: "وشو يهمّك في القاعة الصامتة؟", en: "What brings you to the quiet room?" },
  "room.sub.rooms": { ar: "ثلاث قاعات، وثلاث مزاجات — اختر واحدة، ونحجز لك أجمل كرسيٍّ متاح فيها فوراً.", en: "Three rooms, three moods — pick one, and we'll reserve the finest seat available there instantly." },
  "room.sub.goal": { ar: "في الصمت قسمان: طاولاتُ كتابةٍ واسعة، وبارٌ للّوحد مع لابتوبك. اختر ما يليق بتركيزك.", en: "The quiet room holds two sections: generous writing tables, and a bar for you and your laptop alone. Choose what suits your focus." },
  "room.err.noStudent": { ar: "بيانات الطالب غير موجودة، الرجاء إعادة التسجيل", en: "Student data not found — please register again" },
  "room.err.generic": { ar: "حدث خطأ ما", en: "Something went wrong" },
  "room.err.network": { ar: "حدث خطأ في الاتصال", en: "Connection error" },
  "room.assigning": { ar: "نُسند لك أجمل كرسيٍّ متاح…", en: "Reserving the finest seat for you…" },
  "room.liveBadge": { ar: "هدوءٌ تامّ", en: "Absolute silence" },
  "room.back": { ar: "رجوع إلى القاعات", en: "Back to the rooms" },
  "room.social.name": { ar: "Social", en: "Social" },
  "room.social.desc": { ar: "خمس طاولاتٍ دائرية تحت أضواءٍ دافئة — للجلوس مع من تحبّ.", en: "Five round tables under warm light — for sitting with the people you love." },
  "room.silent.name": { ar: "Silent", en: "Silent" },
  "room.silent.desc": { ar: "بلا موسيقى وبلا ضجيج — للكتابة والدراسة المركّزة.", en: "No music, no noise — for writing and deeply focused study." },
  "room.smoking.name": { ar: "Smoking Area", en: "Smoking Area" },
  "room.smoking.desc": { ar: "بارٌ خاصّ لمن يفضّل دخانه في مكانٍ محترم.", en: "A private bar for those who prefer their smoke in a considered place." },
  "room.goal.writing.title": { ar: "قراءة، كتابة، أو صحبةٌ هادئة", en: "Reading, writing, or quiet company" },
  "room.goal.writing.hint": { ar: "طاولات الكتابة الواسعة", en: "The generous writing tables" },
  "room.goal.bar.title": { ar: "لحالي، مع لابتوبي", en: "Just me and my laptop" },
  "room.goal.bar.hint": { ar: "البار الدراسي الهادئ", en: "The quiet study bar" },

  // ─── صفحة الجلسة ─────────────────────────────────────
  "session.active": { ar: "أنت الآن ضيفٌ في Focus Point", en: "You're now a guest at Focus Point" },
  "session.metaTitle": { ar: "الجلسة", en: "Session" },
  "session.err.title": { ar: "تعذّر تحميل الجلسة", en: "Couldn't load session" },
  "session.err.body": { ar: "حدث خطأ غير متوقع أثناء جلب البيانات. تحقّق من اتصال الخادم ثم حاول مرة أخرى.", en: "An unexpected error occurred while loading. Check the server connection and try again." },
  "session.err.retry": { ar: "إعادة المحاولة", en: "Try again" },
  "session.duration": { ar: "وقتك معنا", en: "Your time with us" },
  "session.roomNote": { ar: "وأنهِ زيارتك متى شئت — الفريق على بعد خطوة", en: "End your visit whenever you wish — the team is always one step away" },
  "session.roomPrefix": { ar: "قاعتك", en: "Your room" },
  "session.roomName.social": { ar: "القاعة الاجتماعية", en: "The Social Room" },
  "session.roomName.silent": { ar: "قاعة الصمت", en: "The Quiet Room" },
  "session.roomName.smoking": { ar: "منطقة التدخين", en: "The Smoking Area" },
  "session.spot.table": { ar: "طاولة", en: "Table" },
  "session.spot.writingTable": { ar: "طاولة الكتابة", en: "Writing Table" },
  "session.spot.studyBar": { ar: "البار الدراسي", en: "Study Bar" },
  "session.spot.smokingBar": { ar: "بار التدخين", en: "Smoking Bar" },
  "session.spot.seat": { ar: "مقعد", en: "Seat" },
  "session.requestService": { ar: "اطلب خدمةً إلى مقعدك", en: "Request a service to your seat" },

  // ─── طلبات الخدمات ───────────────────────────────────
  "services.miniTitle": { ar: "وقتك معنا", en: "Your time with us" },
  "services.miniTooltip": { ar: "مدّة جلستك الجميلة معنا", en: "The time you've spent with us" },
  "services.badge": { ar: "ضيافة المكان", en: "Our hospitality" },
  "services.title": { ar: "خدماتٌ تصلك إلى مقعدك", en: "Services, brought to your seat" },
  "services.sub": { ar: "اختر ما يلهمك، وسنصل إليك إلى مقعدك قبل أن تنتهي فكرتك.", en: "Choose what inspires you — we'll bring it to your seat before the thought is over." },
  "services.currency": { ar: "ل.س", en: "SYP" },
  "services.priceBwSuffix": { ar: "سعر أبيض وأسود", en: "B&W price" },
  "services.printCard": { ar: "طباعة", en: "Printing" },
  "services.backToSession": { ar: "العودة إلى الجلسة", en: "Back to session" },

  // ─── نموذج الطلب (ServicesClient) ────────────────────
  "services.form.badgePrint": { ar: "تخصيص الطباعة", en: "Print setup" },
  "services.form.badgeOrder": { ar: "تخصيص الطلب", en: "Order setup" },
  "services.form.titlePrint": { ar: "طلب: طباعة", en: "Request: Printing" },
  "services.form.orderPrint": { ar: "طلب: {name}", en: "Request: {name}" },
  "services.form.subPrint": { ar: "ارفع ملفك وحدد خيارات الطباعة.", en: "Upload your file and set the print options." },
  "services.form.subOrder": { ar: "أدخل الكمية وأي ملاحظة إضافية.", en: "Enter the quantity and any extra note." },
  "services.form.file": { ar: "الملف المراد طباعته *", en: "File to print *" },
  "services.form.fileHint": { ar: "الأنواع المسموحة: {types} • حتى {mb}MB", en: "Allowed types: {types} • up to {mb}MB" },
  "services.form.printType": { ar: "نوع الطباعة", en: "Print type" },
  "services.form.copies": { ar: "عدد النسخ", en: "Copies" },
  "services.form.copiesHint": { ar: "حتى 4 نسخ كحد أقصى", en: "Up to 4 copies max" },
  "services.form.paper": { ar: "نوع الورق", en: "Paper size" },
  "services.form.printMode": { ar: "طريقة الطباعة", en: "Print mode" },
  "services.form.orientation": { ar: "الاتجاه", en: "Orientation" },
  "services.form.quantity": { ar: "الكمية", en: "Quantity" },
  "services.form.sugar": { ar: "مستوى السكر", en: "Sugar level" },
  "services.form.note": { ar: "ملاحظة (اختياري)", en: "Note (optional)" },
  "services.form.placeholderPrint": { ar: "مثال: ملوّن أهم الصفحات", en: "e.g. color the important pages" },
  "services.form.placeholderOrder": { ar: "مثال: بارد جداً", en: "e.g. very cold" },
  "services.form.submit": { ar: "إرسال الطلب", en: "Send order" },
  "services.form.submitting": { ar: "جارٍ الإرسال...", en: "Sending..." },
  "services.form.cancel": { ar: "إلغاء", en: "Cancel" },

  // ─── شاشة نجاح الإرسال ───────────────────────────────
  "services.done.title": { ar: "وصل طلبك إلى الفريق", en: "Your request reached the team" },
  "services.done.sub": { ar: "سنحضّره لك بأدبٍ وسرعة، فخذ نفساً وأكمل.", en: "We'll prepare it with care and speed — take a breath and carry on." },
  "services.done.another": { ar: "اطلب خدمةً أخرى", en: "Request another service" },

  // ─── رسائل خطأ/نجاح الخدمات ──────────────────────────
  "services.err.fileMissing": { ar: "يجب رفع ملف للطباعة", en: "Please upload a file to print" },
  "services.err.types": { ar: "نوع الملف غير مسموح. الأنواع المدعومة: {types}", en: "File type not allowed. Supported types: {types}" },
  "services.err.size": { ar: "حجم الملف يتجاوز الحد الأقصى ({mb} ميغابايت)", en: "File size exceeds the maximum ({mb} MB)" },
  "services.err.copies": { ar: "عدد النسخ يجب أن يكون بين 1 و 4", en: "Copies must be between 1 and 4" },
  "services.err.quantity": { ar: "أدخل كمية صحيحة (رقم موجب)", en: "Enter a valid quantity (positive number)" },
  "services.err.send": { ar: "حدث خطأ أثناء إرسال الطلب", en: "Error while sending the order" },
  "services.err.network": { ar: "حدث خطأ في الاتصال", en: "Connection error" },
  "services.ok.print": { ar: "تم إرسال طلب الطباعة بنجاح", en: "Print order sent successfully" },
  "services.ok.order": { ar: "تم إرسال طلبك بنجاح", en: "Your order was sent successfully" },

  // ─── خيارات الطباعة والسكر ───────────────────────────
  "opt.bw": { ar: "أبيض وأسود", en: "Black & white" },
  "opt.color": { ar: "ملوّن", en: "Color" },
  "opt.a4": { ar: "A4", en: "A4" },
  "opt.booklet": { ar: "Booklet", en: "Booklet" },
  "opt.single": { ar: "وجه واحد", en: "Single-sided" },
  "opt.double": { ar: "وجهين", en: "Double-sided" },
  "opt.portrait": { ar: "عمودي", en: "Portrait" },
  "opt.landscape": { ar: "أفقي", en: "Landscape" },
  "sugar.none": { ar: "بدون سكر", en: "No sugar" },
  "sugar.light": { ar: "سكر خفيف", en: "Light" },
  "sugar.medium": { ar: "سكر متوسط", en: "Medium" },
  "sugar.max": { ar: "سكر زيادة", en: "Extra" },

  // ─── تصنيفات الخدمات (عناوين المجموعات) ───────────────
  "cat.drinks": { ar: "مشروبات", en: "Beverages" },
  "cat.print": { ar: "طباعة", en: "Printing" },
  "cat.other": { ar: "أخرى", en: "Other" },

  // ─── حالات صفحة الخدمات (خادومية) ─────────────────────
  "services.err.title": { ar: "حدث خطأ", en: "Something went wrong" },
  "services.err.body": { ar: "تعذّر تحميل صفحة الخدمات، الرجاء المحاولة لاحقاً.", en: "Failed to load the services page — please try again later." },
  "services.empty.title": { ar: "لا توجد خدمات متاحة حالياً", en: "No services available right now" },
  "services.empty.body": { ar: "ستتاح قائمة الخدمات قريباً — يمكنك العودة إلى جلستك الآن.", en: "The services list will be available soon — you can return to your session now." },

  // ─── نهاية الجلسة ────────────────────────────────────
  "ended.title": { ar: "انتهت زيارتك", en: "Your visit has ended" },
  "ended.thanks": { ar: "شكراً لزيارتك", en: "Thank you for visiting" },
  "ended.body": { ar: "كانت لك هنا لحظاتٌ من صفاءٍ تامّ. رتّبنا مقعدك، وأعدنا المكان إلى دفئه المعتاد، ليجد إيقاعك القادم مكاناً أجمل.", en: "You had a few moments of pure clarity here. We've tidied your seat and returned the room to its quiet warmth, ready for the rhythm that's coming next." },
  "ended.note": { ar: "بابنا مفتوح في أي وقت — وسنكون سعداء بعودتك.", en: "Our door stays open — we'll be glad to welcome you back." },
  "ended.duration": { ar: "زمنك معنا", en: "Time with us" },
  "ended.orders": { ar: "طلباتك", en: "Your requests" },
  "ended.badge": { ar: "تم إنهاء الجلسة", en: "Session closed" },
  "ended.register": { ar: "ابدأ زيارةً جديدة", en: "Begin a new visit" },

  // ─── صفحة غير موجودة ─────────────────────────────────
  "notfound.title": { ar: "الصفحة غير موجودة", en: "Page not found" },
  "notfound.sub": { ar: "تعذّر العثور على هذه الجلسة.", en: "This session could not be found." },

  // ─── لوحة الإدارة ────────────────────────────────────
  "admin.login.title": { ar: "لوحة تحكم Focus Point", en: "Focus Point Control Panel" },
  "admin.login.password": { ar: "كلمة المرور:", en: "Password:" },
  "admin.login.errRequired": { ar: "كلمة المرور مطلوبة", en: "Password is required" },
  "admin.login.errWrong": { ar: "كلمة المرور غير صحيحة", en: "Incorrect password" },
  "admin.login.errNetwork": { ar: "حدث خطأ في الاتصال", en: "Connection error" },
  "admin.login.submit": { ar: "دخول", en: "Sign in" },
  "admin.login.submitting": { ar: "جارٍ الدخول...", en: "Signing in..." },
  "admin.login.footnote": { ar: "هذه واجهة المدير فقط. الحماية الحالية مؤقتة وستُستبدل بنظام مصادقة حقيقي لاحقاً.", en: "Admin interface only. Current protection is temporary and will be replaced with a real auth system later." },
  "admin.logout": { ar: "تسجيل الخروج", en: "Sign out" },
  "admin.nav.overview": { ar: "نظرة عامة", en: "Overview" },
  "admin.nav.spaces": { ar: "الأماكن", en: "Spaces" },
  "admin.nav.sessions": { ar: "الجلسات النشطة", en: "Active sessions" },
  "admin.nav.orders": { ar: "الطلبات الواردة", en: "Incoming orders" },
  "admin.nav.report": { ar: "التقارير", en: "Reports" },
  "admin.nav.services": { ar: "الخدمات", en: "Services" },
  "admin.nav.qr": { ar: "باركود الاستقبال", en: "Check-in QR code" },

  // ─── لوحة التحكم العامة ───────────────────────────────
  "admin.chrome.label": { ar: "لوحة التحكم", en: "Control panel" },
  "admin.currency": { ar: "ل.س", en: "SYP" },
  "admin.err.load": { ar: "تعذّر تحميل البيانات", en: "Failed to load data" },
  "admin.err.network": { ar: "فشل الاتصال بالخادم", en: "Failed to connect to the server" },
  "admin.dash.sub": { ar: "ملاحظة: النتائج تتحدّث تلقائياً كل بضع ثوانٍ.", en: "Note: results refresh automatically every few seconds." },
  "admin.dash.links.spaces.desc": { ar: "حالة الأماكن بالتفصيل", en: "Seat status in detail" },
  "admin.dash.links.sessions.desc": { ar: "إنهاء جلسات من هنا", en: "End sessions from here" },
  "admin.dash.links.orders.desc": { ar: "طلبات مساعدة للطلاب", en: "Student service requests" },
  "admin.stats.revenue": { ar: "إيرادات اليوم", en: "Today's revenue" },
  "admin.stats.done": { ar: "{n} طلب مكتمل", en: "{n} orders completed" },
  "admin.stats.refreshing": { ar: "جارٍ التحديث…", en: "Refreshing…" },
  "admin.stats.occupancy": { ar: "الإشغال الحي", en: "Live occupancy" },
  "admin.stats.of": { ar: "من {total}", en: "of {total}" },
  "admin.room.social": { ar: "القاعة الاجتماعية", en: "Social room" },
  "admin.room.silent": { ar: "القاعة الصامتة", en: "Silent room" },
  "admin.room.smoking": { ar: "منطقة التدخين", en: "Smoking area" },

  // ─── أعمدة وعناوين مشتركة ─────────────────────────────
  "admin.col.student": { ar: "الطالب", en: "Student" },
  "admin.col.room": { ar: "القاعة", en: "Room" },
  "admin.col.seat": { ar: "الكرسي", en: "Seat" },
  "admin.col.duration": { ar: "مدة الجلسة", en: "Duration" },
  "admin.col.action": { ar: "إجراء", en: "Action" },
  "admin.col.service": { ar: "الخدمة", en: "Service" },
  "admin.col.category": { ar: "التصنيف", en: "Category" },
  "admin.col.price": { ar: "السعر", en: "Price" },
  "admin.col.time": { ar: "الوقت", en: "Time" },
  "admin.col.place": { ar: "المكان", en: "Place" },
  "admin.col.details": { ar: "التفاصيل", en: "Details" },
  "admin.col.status": { ar: "الحالة", en: "Status" },
  "admin.col.orders": { ar: "الطلبات", en: "Orders" },
  "admin.col.phone": { ar: "الهاتف", en: "Phone" },
  "admin.col.doneCount": { ar: "مكتملة", en: "Done" },
  "admin.col.revenue": { ar: "الإيرادات (ل.س)", en: "Revenue (SYP)" },

  // ─── الجلسات النشطة ───────────────────────────────────
  "admin.sessions.sub": { ar: "الوقت المنقضي يتحدّث حياً، والجلسات تُحدَّث كل بضع ثوانٍ.", en: "Elapsed time updates live; sessions refresh every few seconds." },
  "admin.sessions.empty": { ar: "لا توجد جلسات نشطة حالياً", en: "No active sessions" },
  "admin.sessions.emptyHint": { ar: "عندما يُسجّل طالب مكاناً ستظهر جلسته هنا.", en: "When a student checks in, their session will appear here." },
  "admin.sessions.end": { ar: "إنهاء الجلسة", en: "End session" },
  "admin.sessions.endedT": { ar: "تم إنهاء الجلسة بنجاح", en: "Session ended successfully" },
  "admin.sessions.endFail": { ar: "فشل إنهاء الجلسة", en: "Failed to end session" },
  "admin.sessions.loadFail": { ar: "تعذّر تحميل الجلسات", en: "Failed to load sessions" },

  // ─── خريطة الأماكن ────────────────────────────────────
  "admin.spaces.sub": { ar: "خريطة حية للكراسي في كل قاعة.", en: "Live seat map for every room." },
  "admin.spaces.loadFail": { ar: "تعذّر تحميل الأماكن", en: "Failed to load seats" },
  "admin.map.live": { ar: "مباشر", en: "Live" },
  "admin.map.sub": { ar: "تتحدّث الخريطة تلقائياً كل بضع ثوانٍ.", en: "The map refreshes automatically every few seconds." },
  "admin.map.occupiedSummary": { ar: "{occupied} / {total} مشغول", en: "{occupied} / {total} occupied" },
  "admin.map.free": { ar: "متاح", en: "Free" },
  "admin.map.occupied": { ar: "مشغول", en: "Occupied" },
  "admin.map.studentFallback": { ar: "طالب", en: "Student" },
  "admin.map.freeSeat": { ar: "فاضي", en: "Free" },
  "admin.map.emptySeats": { ar: "لا كراسي في هذه القاعة", en: "No seats in this room" },
  "admin.map.emptySeatsHint": { ar: "تحقق من زراعة الكراسي في قاعدة البيانات.", en: "Check the seat seeding in the database." },
  "admin.map.tapHint": { ar: "اضغط على أي كرسي مشغول لعرض تفاصيل جلسته.", en: "Tap any occupied seat to see its session details." },
  "admin.map.tapHintShort": { ar: "اضغط للتفاصيل", en: "Tap for details" },

  // ─── لوحة تفاصيل الجلسة (من الخريطة) ──────────────────
  "admin.session.title": { ar: "تفاصيل الجلسة", en: "Session details" },
  "admin.session.activeBadge": { ar: "جلسة نشطة", en: "Active session" },
  "admin.session.elapsed": { ar: "المدة المنقضية", en: "Elapsed time" },
  "admin.session.checkIn": { ar: "وقت الدخول", en: "Checked in" },
  "admin.session.orders": { ar: "طلبات الخدمات", en: "Service requests" },
  "admin.session.noOrders": { ar: "لا توجد طلبات في هذه الجلسة.", en: "No requests in this session." },
  "admin.session.confirmEnd": { ar: "تأكيد الإنهاء", en: "Confirm end" },
  "admin.session.loadFail": { ar: "تعذّر تحميل تفاصيل الجلسة", en: "Failed to load session details" },
  "admin.order.pending": { ar: "معلّق", en: "Pending" },
  "admin.order.done": { ar: "مكتمل", en: "Done" },
  "admin.order.cancelled": { ar: "ملغى", en: "Cancelled" },

  // ─── الطلبات الواردة ──────────────────────────────────
  "admin.orders.sub": { ar: "تتحدّث تلقائياً كل بضع ثوانٍ — يُلفت انتباهك عند كل طلب جديد.", en: "Refreshes automatically every few seconds — alerts you on each new order." },
  "admin.orders.cleanup": { ar: "حذف كل الملفات", en: "Delete all files" },
  "admin.orders.cleanupTitle": { ar: "حذف كل الملفات المرفوعة من القرص", en: "Delete all uploaded files from disk" },
  "admin.orders.cleaning": { ar: "جارٍ الحذف...", en: "Deleting…" },
  "admin.orders.pendingCount": { ar: "{n} معلّق", en: "{n} pending" },
  "admin.orders.newAlert": { ar: "طلب جديد!", en: "New order!" },
  "admin.orders.newOrder": { ar: "طلب جديد: {student} — {service}", en: "New order: {student} — {service}" },
  "admin.orders.muteOn": { ar: "كتم صوت تنبيه الطلبات", en: "Mute order alerts" },
  "admin.orders.muteOff": { ar: "تفعيل صوت تنبيه الطلبات", en: "Unmute order alerts" },
  "admin.orders.soundMuted": { ar: "الصوت: كتم", en: "Sound: off" },
  "admin.orders.soundOn": { ar: "الصوت: فعّال", en: "Sound: on" },
  "admin.orders.empty": { ar: "لا توجد طلبات معلّقة حالياً", en: "No pending orders" },
  "admin.orders.emptyHint": { ar: "الطلبات الجديدة من الطلاب ستظهر هنا فور وصولها.", en: "New student orders will appear here as soon as they arrive." },
  "admin.orders.fileField": { ar: "الملف", en: "File" },
  "admin.orders.printType": { ar: "نوع الطباعة", en: "Print type" },
  "admin.orders.copies": { ar: "النسخ", en: "Copies" },
  "admin.orders.paper": { ar: "الورق", en: "Paper" },
  "admin.orders.mode": { ar: "الطريقة", en: "Mode" },
  "admin.orders.orientation": { ar: "الاتجاه", en: "Orientation" },
  "admin.orders.note": { ar: "ملاحظة", en: "Note" },
  "admin.orders.quantity": { ar: "الكمية", en: "Qty" },
  "admin.orders.sugar": { ar: "السكر", en: "Sugar" },
  "admin.orders.download": { ar: "تحميل الملف", en: "Download file" },
  "admin.orders.done": { ar: "تم", en: "Done" },
  "admin.orders.updated": { ar: "تم تحديث الطلب بنجاح", en: "Order updated successfully" },
  "admin.orders.updateFail": { ar: "فشل تحديث الطلب", en: "Failed to update order" },
  "admin.orders.cleaned": { ar: "تم حذف {n} ملفاً من المرفوعات", en: "Deleted {n} uploaded files" },
  "admin.orders.cleanFail": { ar: "فشل حذف الملفات", en: "Failed to delete files" },
  "admin.orders.loadFail": { ar: "تعذّر تحميل الطلبات", en: "Failed to load orders" },

  // ─── إدارة الخدمات ────────────────────────────────────
  "admin.services.sub": { ar: "إدارة الخدمات وأسعارها.", en: "Manage services and prices." },
  "admin.services.edit": { ar: "تعديل", en: "Edit" },
  "admin.services.delete": { ar: "حذف", en: "Delete" },
  "admin.services.empty": { ar: "لا توجد خدمات بعد، أضف أول خدمة.", en: "No services yet — add the first one." },
  "admin.services.editTitle": { ar: "تعديل الخدمة", en: "Edit service" },
  "admin.services.addTitle": { ar: "إضافة خدمة", en: "Add service" },
  "admin.services.serviceName": { ar: "اسم الخدمة", en: "Service name" },
  "admin.services.catPlaceholder": { ar: "مثال: مشروبات، طباعة", en: "e.g. Beverages, Printing" },
  "admin.services.priceField": { ar: "السعر (ل.س)", en: "Price (SYP)" },
  "admin.services.save": { ar: "حفظ…", en: "Saving…" },
  "admin.services.saveEdit": { ar: "حفظ التعديلات", en: "Save changes" },
  "admin.services.add": { ar: "إضافة", en: "Add" },
  "admin.services.cancel": { ar: "إلغاء", en: "Cancel" },
  "admin.services.savedEdit": { ar: "تم حفظ التعديلات بنجاح", en: "Changes saved successfully" },
  "admin.services.savedAdd": { ar: "تمت إضافة الخدمة بنجاح", en: "Service added successfully" },
  "admin.services.deleted": { ar: "تم حذف الخدمة", en: "Service deleted" },
  "admin.services.saveFail": { ar: "فشل حفظ الخدمة", en: "Failed to save service" },
  "admin.services.deleteFail": { ar: "فشل حذف الخدمة", en: "Failed to delete service" },
  "admin.services.confirmDelete": { ar: "متأكد من حذف هذه الخدمة؟", en: "Delete this service?" },
  "admin.services.loadFail": { ar: "تعذّر تحميل الخدمات", en: "Failed to load services" },

  // ─── باركود الاستقبال ─────────────────────────────────
  "admin.qr.sub": { ar: "اعرض الباركود وطبعه، ثم ضعه عند المدخل ليبدأ الطلاب جلستهم بالمسح.", en: "Display and print the code, then place it at the entrance so students can scan to start." },
  "admin.qr.chooseNetwork": { ar: "اختر الشبكة", en: "Choose network" },
  "admin.qr.connected": { ar: "متصل", en: "Connected" },
  "admin.qr.failed": { ar: "تعذر الاكتشاف", en: "Detection failed" },
  "admin.qr.discovering": { ar: "جارٍ الاكتشاف…", en: "Detecting…" },
  "admin.qr.refresh": { ar: "تحديث", en: "Refresh" },
  "admin.qr.failedMsg": { ar: "تعذّر اكتشاف واجهات الشبكة تلقائياً — عرضنا الرابط الاحتياطي من .env.local", en: "Couldn't auto-detect network interfaces — showing the fallback URL from .env.local" },
  "admin.qr.scanHint": { ar: "امسح لتبدأ جلستك", en: "Scan to start your session" },
  "admin.qr.print": { ar: "طباعة", en: "Print" },
  "admin.qr.urlTitle": { ar: "الرابط المُشفَّر في الباركود", en: "The URL encoded in the code" },
  "admin.qr.codeTitle": { ar: "Focus Point — باركود الاستقبال", en: "Focus Point — check-in QR code" },
  "admin.qr.note": { ar: "الباركود بيتحدّث تلقائياً حسب شبكة الجهاز الحالية — بس لو نَقَلت الجهاز لشبكة WiFi تانية، لازم تطبع باركود جديد لأن الرابط بيتغيّر فعلياً حسب الشبكة.", en: "The code auto-updates based on the device's current network — if you move to another WiFi, print a new code because the link actually changes." },
  "admin.qr.loadFail": { ar: "تعذّر اكتشاف واجهات الشبكة", en: "Failed to detect network interfaces" },

  // ─── التقارير ─────────────────────────────────────────
  "admin.report.sub": { ar: "سجل الخدمات المقدّمة لكل طالب على حدة، مع ملخص العمليات وتصدير نسخة Excel منسّقة عن قاعدة البيانات المحلية.", en: "Per-student service log with an operations summary and export of a formatted Excel copy of the local database." },
  "admin.report.from": { ar: "من تاريخ", en: "From date" },
  "admin.report.to": { ar: "إلى تاريخ", en: "To date" },
  "admin.report.updating": { ar: "جارٍ التحديث…", en: "Updating…" },
  "admin.report.autoNote": { ar: "يتحدّث عند تغيير الفترة", en: "Updates when the range changes" },
  "admin.report.download": { ar: "تنزيل Excel منسّق", en: "Download formatted Excel" },
  "admin.report.footnote": { ar: "التقرير لقطة (نسخة) للقراءة فقط من قاعدة البيانات المحلية داخل الفترة المحددة، والبيانات تبقى مسجّلة كما هي في القاعدة الأصلية. تُحسب الأيام وفق توقيت دمشق.", en: "The report is a read-only snapshot of the local database within the selected period; original data stays untouched. Days are computed per Damascus time." },
  "admin.report.studentsCard": { ar: "طلاب زارونا", en: "Students visited" },
  "admin.report.sessionsUnit": { ar: "{n} جلسة", en: "{n} sessions" },
  "admin.report.ordersUnit": { ar: "{n} طلب", en: "{n} orders" },
  "admin.report.ordersCard": { ar: "إجمالي الطلبات", en: "Total orders" },
  "admin.report.ordersBreakdown": { ar: "{n} تم • {p} معلّق • {c} ملغى", en: "{n} done • {p} pending • {c} cancelled" },
  "admin.report.revenueCard": { ar: "إيرادات الفترة", en: "Period revenue" },
  "admin.report.revenueSub": { ar: "من {n} طلب منفّذ", en: "from {n} fulfilled orders" },
  "admin.report.servicesCard": { ar: "الخدمات المُباعَة", en: "Services sold" },
  "admin.report.servicesSub": { ar: "أنواع مختلفة", en: "different types" },
  "admin.report.servicesTitle": { ar: "ملخص الخدمات", en: "Services summary" },
  "admin.report.studentLog": { ar: "سجل الخدمات لكل طالب", en: "Per-student service log" },
  "admin.report.noData": { ar: "لا توجد بيانات في الفترة المحددة.", en: "No data in the selected period." },
  "admin.report.phone": { ar: "هاتف: {phone}", en: "Phone: {phone}" },
  "admin.report.noPhone": { ar: "بدون رقم هاتف", en: "No phone number" },
  "admin.report.seat": { ar: "مقعد {n}", en: "Seat {n}" },
  "admin.report.noOrders": { ar: "زيارة دون طلبات", en: "Visit without orders" },
  "admin.report.loadFail": { ar: "تعذّر تحميل التقرير", en: "Failed to load report" },
  "admin.report.place.social_table": { ar: "طاولة اجتماعية", en: "Social table" },
  "admin.report.place.silent_writing": { ar: "طاولة الكتابة", en: "Writing table" },
  "admin.report.place.silent_bar": { ar: "بار الصامتة", en: "Silent bar" },
  "admin.report.place.smoking_bar": { ar: "بار التدخين", en: "Smoking bar" },
  "admin.status.pending": { ar: "معلّق", en: "Pending" },
  "admin.status.done": { ar: "تم", en: "Done" },
  "admin.status.cancelled": { ar: "ملغى", en: "Cancelled" },

  // ─── إعدادات لغة مشتركة ───────────────────────────────
  "meta.locale": { ar: "ar-SY", en: "en-GB" },
} as const;

export type DictKey = keyof typeof dict;

/** حرف أول من سلسلة (للعناوين بالإنكليزية). */
function cap(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * ترجمة مفتاح قاموس أو إدخال جاهز إلى اللغة المطلوبة.
 * - مفتاح (string موجود في القاموس) → يترجم.
 * - إدخال { ar, en } → يترجم مباشرة.
 * - أي سلسلة أخرى → تعود كما هي (fallback آمن للسلاسل الديناميكية).
 */
export function translate(
  value: MaybeEntry | DictKey,
  lang: Lang
): string {
  if (typeof value === "string") {
    if (value in dict) return pick(dict[value as DictKey], lang);
    return value;
  }
  if (!value) return "";
  const text = value[lang] ?? value.ar;
  if (lang === "en") {
    const capped = cap(text);
    return capped === text ? text : capped;
  }
  return text;
}

/** استبدال {name} داخل نص قاموس بقيمة ديناميكية. */
export function translateWith(
  key: DictKey,
  lang: Lang,
  params: Record<string, string | number>
): string {
  let text = translate(key, lang);
  for (const [k, v] of Object.entries(params)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

/** اختيار النص المناسب للغة الحالية من إدخال قاموس. */
export function pick(value: MaybeEntry, lang: Lang): string {
  if (typeof value === "string") return value;
  if (!value) return "";
  const text = value[lang] ?? value.ar;
  if (lang === "en") return cap(text);
  return text;
}

/** قراءة اللغة من قيمة كوكي خام (أو فراغ). */
export function langFromValue(raw: string | null | undefined): Lang {
  return raw === "en" ? "en" : "ar";
}

/** اللغة المقابلة الحالية (للتبديل). */
export function otherLang(lang: Lang): Lang {
  return lang === "ar" ? "en" : "ar";
}

/** تسمية اللغة بالعربي (للعرض في المفتاح). */
export function langLabel(lang: Lang): string {
  return lang === "ar" ? "العربية" : "English";
}

/** اسم القاعة حسب اللغة. */
export function roomName(id: string, lang: Lang): string {
  return pick(
    {
      silent: dict["room.silent.name"],
      social: dict["room.social.name"],
      smoking: dict["room.smoking.name"],
    }[id],
    lang
  );
}

/** شارة نوع القاعة (صامتة/اجتماعية/تدخين). */
export function roomBadge(id: string, lang: Lang): string {
  return pick(
    {
      silent: { ar: "صامتة", en: "Silent" },
      social: { ar: "اجتماعية", en: "Social" },
      smoking: { ar: "تدخين", en: "Smoking" },
    }[id],
    lang
  );
}