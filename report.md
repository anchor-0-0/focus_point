# Focus Point — تقرير المشروع ودليل التشغيل

> وثيقة مرجعية لمشروع **Focus Point**: نظام حجز مقاعد في مساحة عمل هادئة (قاعات Social / Silent / Smoking) مع لوحة تحكم للمشرف وباركود استقبال للطلّاب.
> تاريخ التقرير: 2026-09-28 — الإصدار حاضر في هذا المستودع.

---

## 1. نظرة عامة

- **الطلاب**: تسجيل عبر صفحة السبلاش (الاسم + الهاتف)، اختيار قاعة، تخصيص مقعد، شاشة عدّاد بطل حي، صفحة خدمات (طباعة + مشروبات)، إنهاء الجلسة من الأدمن يختتم الجلسة ويعيد الطالب تلقائياً إلى شاشة «انتهت زيارتك».
- **الأدمن**: لوحة تحكم (`/admin`) بجلسة واحدة في الذاكرة، إحصاءات حية، خريطة كراسي، قائمة مقاعد، إدارة جلسات نشطة، طلبات واردة تنبيهية (toast + جرس صوتي)، إدارة خدمات، تقرير Excel، باركود استقبال يبني رابط الجهاز تلقائياً.
- **التقنيات**: Next.js 16 (App Router) + React 19 + Tailwind 4 + Prisma 7 (provider `prisma-client`) + PostgreSQL + ExcelJS.
- **الواجهة**: عربية/إنجليزية ثنائية، خط Cairo، ألوان دافئة (`#FBF8F5` خلفية) وفق مرجع `FOCUS_POINT (1).md`.

### نتائج التحقق النهائية (بوابة 100%)

| الفحص | النتيجة |
| --- | --- |
| E2E عبر HTTP (تدفق الطالب + الأدمن + الرموز + الأمان) | **51 / 51** مصادق |
| فحص متصفح حقيقي (Chrome عبر CDP — سطح مكتب + هاتف 390×844) | **50 / 50** مصادق |
| التحقق من قاعدة البيانات (`scripts/db-verify.ts`) | متسقة: 0 مقعد مزدوج، 0 جلسة نشطة معطلّة، أعلام `is_occupied` مضاهاة تماماً |
| `npx tsc --noEmit` | نظيف (0 أخطاء) |
| `npm run lint` | نظيف (0 مشكلات) |
| `npm run build` | نجح |
| `npm audit` | 0 critical، 4 high + 2 moderate (انظر §11) |

---

## 2. Stack and Versions

| Layer | Tool | Installed | Notes |
| --- | --- | --- | --- |
| Runtime | Node.js | v26.1.0 | Next 16 requires Node 20.9+ |
| Package manager | npm | 11.17.0 | `package-lock.json` committed |
| Framework | Next.js | 16.3.4 | App Router; `next build --webpack` / `next dev --webpack` |
| UI | React / React DOM | 19.2.8 | Client components under `src/app/**` |
| Styling | Tailwind CSS | 4.3.3 | Tailwind v4 PostCSS plugin |
| Language | TypeScript | 5.9.3 | Strict typing throughout |
| ORM | Prisma | 7.10.0 | Generator `prisma-client` → `prisma/generated/prisma` |
| Prisma client | @prisma/client + @prisma/adapter-pg | 7.10.0 | Adapter `pg` pool |
| Database | PostgreSQL | 18.6 | DB `focus_point` @ `localhost:5432`, schema `public` |
| Excel | exceljs | 4.4.0 | `/admin/report` export |
| QR | qrcode.react | 4.2.0 | `/admin/qr-code` runtime URL |
| Postgres driver | pg | 8.23.0 | Via Prisma adapter |
| Tooling | tsx | 4.23.13 | Maintenance scripts (`scripts/`) |
| Lint | eslint + eslint-config-next | 9.39.5 / 16.3.4 | React Compiler-aware rules enabled |

---

## 3. Dependency Table

| Package | Version | Purpose |
| --- | --- | --- |
| `next` | 16.3.4 | Framework (server + client) |
| `react`, `react-dom` | 19.2.8 | UI runtime |
| `@prisma/client`, `@prisma/adapter-pg` | 7.10.0 | Typesafe DB client |
| `prisma` (dev) | 7.10.0 | CLI (generate / migrate / seed) |
| `pg` | 8.23.0 | PostgreSQL driver |
| `exceljs` | 4.4.0 | XLSX report export |
| `qrcode.react` | 4.2.0 | Check-in QR on `/admin/qr-code` |
| `dotenv` | 17.4.2 | Load `.env.local` (Prisma config + scripts) |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.3 | Utility-first CSS |
| `typescript`, `@types/*` | 5.9.3 / (node, react, react-dom) | Types |
| `eslint`, `eslint-config-next`, `tsx` | 9.39.5 / 16.3.4 / 4.23.13 | Lint + TS script runner |

Full tree with transitive packages is maintained by `package-lock.json`. Run `npm ci` for reproducible installs.

---

## 4. متطلبات التشغيل

| المتطلب | الحد الأدنى | المثبّت حالياً على هذا الجهاز |
| --- | --- | --- |
| نظام التشغيل | Windows 10/11 x64 | Windows 10 IoT Enterprise LTSC 19044 (AMD64) |
| المعالج | x64 2 كيلات+ | Intel Core i5-6300U @ 2.40 GHz (4 منطقي) |
| الذاكرة | 8 GB (مريح) — الأقل يشتغل ضمن الحدود | **3.4 GB RAM فقط** (انظر §11) |
| القرص | 10 GB حر مبدئياً | 195 GB إجمالي / 80 GB حر |
| Node.js | 20.9+ | v26.1.0 |
| PostgreSQL | 16+ | 18.6 — خدمة قاعدة موثوقة `focus_point` على `localhost:5432` |
| المنفذ | 3000 حر | مخصص للتطبيق |

ملاحظات:
- خادم Postgres يجب أن يعمل كخدمة Windows تبدأ تلقائياً عند الإقلاع (ضمن إعدادات تثبيت PostgreSQL).
- التطبيق لا يعمل بالاعتماد على `public/uploads` — ملفات الطباعة تُحفظ خارج `public` في دليل `UPLOAD_DIR` (أو `<المشروع>/uploads` افتراضياً، وهو داخل `.gitignore`).

---

## 5. Installation From Scratch

> هذه الخطوات تفترض جهازاً جديداً. لا يُنفَّذ شيء منها فوق البيانات الحالية دون نسخ احتياطي (انظر §8).

1. **نسخة المشروع + الإعدادات**
   - انسخ المجلد أو استنسِخ المستودع إلى مسار بدون مسافات إن أمكن (مثل `C:\apps\studyzones-v2`).
   - أنشئ `.env.local` من `C:\Users\Rebo\Desktop\StudyZone\.env.local.example` وعبّئ القيم:
     - `DATABASE_URL=postgresql://<user>:<password>@localhost:5432/focus_point`
     - `ADMIN_PASSWORD=<كلمة سر قوية>` — تُستعمل فقط في `/api/admin/login` (لا تشاركها).
     - `UPLOAD_DIR=<مسار>` (اختياري؛ الغيابه = `<المشروع>/uploads`).
     - `NEXT_PUBLIC_CHECKIN_URL=http://localhost:3000/checkin` (fallback للباركود؛ يكتشف IP الجهاز تلقائياً وقت التشغيل).

2. **التثبيتات**
   - `npm ci` (يقرأ `package-lock.json`).
   - `npm run db:generate`.

3. **قاعدة البيانات**
   - تجهيز قاعدة فارغة باسم `focus_point` في PostgreSQL.
   - `npm run db:migrate` أو `npx prisma migrate deploy` لتطبيق المخططات الـ6 المطلوبة.
   - (أول مرة فقط) `npm run db:seed` لتعريف المقاعد الـ35؛ **تحذير**: seed يعيد تعريف بيانات المقاعد، لا تشغّله على بيانات فعلية.

4. **التشغيل**
   - `npm run build`
   - `node node_modules\next\dist\bin\next start -p 3000`
   - تأكد من الصحة: `http://localhost:3000/api/health` → `{"ok":true,...,"spots_count":35}`.

---

## 6. Persistent Operation

- **التشغيل الإنتاجي** (عبر `next start`). يُفضَّل تشغيله كخدمة Windows دائمة حتى لا يتوقف عند إغلاق الطرفية:
  - **الخيار المقترح (NSSM)**: `nssm install FocusPoint` ثم تعيين:
    - Application: `C:\Program Files\nodejs\node.exe`
    - Arguments: `node_modules\next\dist\bin\next start -p 3000`
    - Startup directory: مسار المشروع — AppExit: Restart.
  - **أو Task Scheduler**: مهمة عند تسجيل الدخول/بدء التشغيل تنفّذ الأمر أعلاه مع `-WindowStyle Hidden`.
- **غير مطبَّق حالياً**: لا توجد خدمة Windows مركّبة لهذه النسخة؛ إعادة التشغيل اليدوية متاحة (`npm run build` ثم `next start`). ننصح بتركيب NSSM كخطوة استكمال.
- **PostgreSQL**: تأكد أن خدمة `postgresql-x64-18` مضبوطة على `Automatic` في `services.msc`.
- **رقابة الإقلاع**: عند كل إقلاع تحقق من `http://localhost:3000/api/health` عبر أي متصفح.

---

## 7. دليل الاستخدام اليومي

### للمشرف (لوحة التحكم)
- افتح `http://<IP>:3000/admin` — تُطلب كلمة السر (المُعرَّفة في `.env.local` فقط).
- **نظرة عامة**: إيرادات اليوم + إشغال القاعات (تحديث تلقائي كل 5 ثوانٍ).
- **الأماكن**: خريطة الكراسي (35 مقعداً) بعلامات ملونة: مشغول/فارغ، والنقر على الكرسي المشغول يعرض الطالب والمدة.
- **الجلسات النشطة**: قائمة الجلسات مع زمن منقضٍ حي؛ زر «إنهاء» يُنهي الجلسة ويحرّر المقعد ويُحوّل طلباتها إلى `cancelled` ويردّ الطالب لشاشة الانتهاء.
- **الطلبات الواردة**: تنبيه toast فوري + جرس صوتي (يُفعَّل الصوت عند أول لمسة/نقرة — سياسة المتصفحات)؛ زر «تم» ينقل الطلب إلى `done`.
- **الخدمات**: إضافة/تعديل/حذف خدمات الطباعة والمشروبات.
- **التقارير**: تصدير Excel للطلبات.
- **باركود الاستقبال**: يعرض رابط الاستقبال لعنوان الجهاز الفعلي المكتشف تلقائياً (فمثلاً `http://192.168.72.211:3000/checkin`) ويحدث حال تغيّر IP.

### للطالب
- على الشاشة الأمنة: أدخل الاسم والهاتف، اختر القاعة، يُعطى مقعداً على البطاقة، وسيظهر عدّاد «وقتك معنا».
- من صفحة الجلسة: زر «طلب خدمة» للطباعة أو المشروبات (مع تحديد الكمية ومستوى السكر).
- عند إنهاء المشرف للجلسة: ينتقل الطالب تلقائياً إلى شاشة «انتهت زيارتك».

---

## 8. الترحيل والنسخ الاحتياطي

### النسخ الاحتياطي المنتظم
- **قاعدة البيانات**: `pg_dump -h localhost -U postgres -d focus_point -Fc -f focus_point.dump` (أو نسخة من ملفات `data` مع إيقاف الخدمة).
- **الملفات**: حاوية النسخ تشمل:
  - `prisma/migrations`, `prisma/schema.prisma`,
  - `.env.local` (الأسرار — لا تُرفع إلى Git),
  - دليل `UPLOAD_DIR` أو `uploads/` (المستندات المرفوعة للطباعة),
  - النسخة كاملة من الكود.
- **الترتيب**: Data وBase معاً في نفس اللحظة المتفق عليها.

### الاستعادة
1. `psql -h localhost -U postgres -d focus_point -f backup.sql` أو `pg_restore -d focus_point focus_point.dump` بعد إنشاء قاعدة فارغة.
2. إعادة وضع `.env.local` بنفس الأسرار ثم `npm ci`.
3. `npx prisma migrate status` للتأكد أن المخططات متطابقة (6 migrations).
4. إعادة `UPLOAD_DIR` مكانه ثم تشغيل `next start`.
5. فحص `/api/health` ثم تجربة `/admin` والباركود.

---

## 9. التشخيص وحل المشكلات

| العرض | السبب الشائع | الحل |
| --- | --- | --- |
| `توجد جلسة مدير مفعّلة بالفعل` عند الدخول (HTTP 409) | التطبيق يتيح جلسة أدمن واحدة في الذاكرة فقط، وهي باقية | أعد تشغيل الخادم (يُفرّغ الجلسة) أو استخدم الجلسة القائمة |
| الباركود يعرض رابط IP قديم | عنوان الجهاز تغيّر (DHCP) | افتح `/admin/qr-code` —— يُكتشف IP حالي تلقائياً للتو |
| `ECONNREFUSED :3000` | الخادم متوقف | `node node_modules\next\dist\bin\next start -p 3000` ثم فحص `/api/health` |
| فشل اتصال القاعدة `focus_point` | خدمة PostgreSQL متوقفة | ابدأها من `services.msc` وتأكد `Automatic` |
| `Login failed` للأدمن | `ADMIN_PASSWORD` مختلف في `.env.local` | طابق القيمة ثم أعد التشغيل |
| الصوت لا يعمل في المتصفح | سياسة autoplay للصوت | أول نقرة/لمسة على الصفحة (أو أي تفاعل) تُفعّل الصوت بعدها |
| تحذير SWC في البناء: `next-swc.win32-x64-msvc.node is not a valid Win32 application` | شذوذ بيئة تنزيل الـnative binary على هذا الجهاز | غير مانع: البناء والفحوصات تنجح؛ يُتتبع ضمن §11 |
| Text Arabic مشوّه في الطرفية | ترميز عرض PowerShell | اقرأ الملفات عبر محرر UTF-8؛ لا يعكس خللاً في التطبيق |
| الأزرار تظهر بيضاء (بلا خلفية عنابية) | قيم `rgba(…)` ناقصة قيمة alpha (فاصلة أخيرة بلا رقم) في `globals.css` تسقط التصريح كله | أُصلح 9 مواضع من `rgba(x, y, z, )` إلى alpha صريحة (0.15–0.55)؛ تحقق بالفحص: computed `background-image` للزر يعرض التدرج |
| بيانات/خدمات مفقودة بالجهاز الجديد | تثبيت بـ `npm install` بدل `npm ci` مع إصدارات `^` | ثُبّتت إصدارات `tailwindcss`/`@tailwindcss/postcss` عند 4.3.3 في `package.json`؛ استعمل `npm ci` |

---

## 10. أوامر التشغيل السريعة

```bash
# تطوير
npm run dev

# بناء إنتاجي
npm run build

# تشغيل إنتاجي (يدوي)
node node_modules\next\dist\bin\next start -p 3000

# تحقق الجودة
npm run lint
npx tsc --noEmit
npx eslint src

# قاعدة البيانات
npm run db:generate
npm run db:migrate        # تطوير (migrate dev)
npx prisma migrate deploy # إنتاج
npm run db:seed           # أول مرة فقط

# أدوات
npx tsx scripts/cleanup-uploads.ts   # تنظيف ملفات الطباعة القديمة
npx tsx scripts/db-verify.ts         # فحص تكامل قاعدة البيانات (قراءة فقط)

# فحوصات البوابة (خارج هذا المستودع — أدوات تحقق)
node <temp>\opencode\e2e.mjs         # 51 فحص HTTP
node <temp>\opencode\browser-check.mjs  # 50 فحص بمتصفح حقيقي
```

---

## 11. الحدود المعروفة

- **`npm audit` غير نظيف تماماً**: 0 critical/0 low، **4 high** (كلها ضمن سلسلة أدوات Prisma 7 CLI: `prisma`, `@prisma/config`, `deepmerge-ts`, `mysql2`) و**2 moderate** (`exceljs → uuid`, `uuid`). الترقية الوحيدة المتاحة تتطلب downgrade كاسر إلى `prisma@6.19.3` فلم تُطبق (رفضنا `audit fix --force`). يُنصح بالترقية عند توافر إصلاح غير كاسر.
- **جلسة أدمن واحدة في الذاكرة**: لا ميكنة للمستخدمين المتعددين؛ إعادلة تشغيل الخادم تُسقطها.
- **الباركود يعمل عبر HTTP على الشبكة المحلية** (لا TLS) وعنوان IP يتغير مع DHCP — مناسب للاستخدام الداخلي فقط، ويُفحص من نفس الشبكة.
- **ذاكرة الجهاز 3.4 GB فقط**: مع خادم Next + PostgreSQL + Chrome تبقى مساحات ضيقة؛ يُنصح بالترقية إلى 8 GB لتشغيل مريح.
- **تحذير SWC**: ظهور «not a valid Win32 application» أثناء البناء على هذا الجهاز؛ غير مانع للبناء/التشغيل لكنه يُراقَب.
- **الصوت**: يعمل بعد أول تفاعل مستخدم في المتصفح (قيود autoplay)؛ تم التحقق برمجياً من بدء مذبذبين في Chrome فعلي.
- **لا توجد خدمة Windows مركّبة** ولا نسخ احتياطي مجدول بعد — خطوة نُوصي بإتمامها (§6, §8).
- **فحص الصور**: يتوفر أدوات عددية + لقطات شاشة لكل صفحة، لكن لا توجد مراجعة بصرية آلية كاملة للبكسل؛ يُنصح بمراجعة سريعة يدوية للقطات.
- **البيانات الحالية**: القاعدة أُفرغت استعداداً للإنتاج في 2026‑09‑28 — 0 طلاب/جلسات/طلبات، وست خدمات (الكشكول) و35 مقعداً ثابتة. لا يوجد seed يمسح بيانات فعلية إلا بتشغيله يدوياً؛ النسخ الاحتياطية الصريحة محفوظة في `C:\Users\Rebo\AppData\Local\Temp\opencode\backup\`.