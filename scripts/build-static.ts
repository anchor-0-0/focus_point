import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const root = process.cwd();
const apiDir = path.join(root, "src", "app", "api");
const tempApiDir = path.join(root, "src", "app", "_api_temp");
const outDir = path.join(root, "out");

console.log("🚀 تجهيز بناء النسخة الثابتة لـ GitHub Pages...");

// تنظيف كاش .next لضمان عدم بقاء أي إدخالات ديناميكية
const nextCache = path.join(root, ".next");
if (fs.existsSync(nextCache)) {
  console.log("🧹 تنظيف كاش .next...");
  try {
    fs.rmSync(nextCache, { recursive: true, force: true });
  } catch {}
}

let apiMoved = false;
let buildFailed = false;
try {
  if (fs.existsSync(apiDir)) {
    console.log("📦 عزل مسارات الـ API مؤقتاً لتفعيل التصدير الثابت (output: export)...");
    fs.renameSync(apiDir, tempApiDir);
    apiMoved = true;
  }

  process.env.NEXT_EXPORT = "true";
  process.env.NEXT_PUBLIC_BASE_PATH = "/focus_point";
  process.env.NEXT_PUBLIC_DEMO_MODE = "true";

  console.log("⚙️  المسار الأساسي: /focus_point");
  console.log("🔨 تشغيل next build --webpack...");

  execSync("npx next build --webpack", {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_EXPORT: "true",
      NEXT_PUBLIC_BASE_PATH: "/focus_point",
      NEXT_PUBLIC_DEMO_MODE: "true",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/focus_point",
    },
  });

  console.log("✨ نجح البناء الثابت!");

  // إضافة ملف .nojekyll لمنع تجاهل مجلدات _next
  if (fs.existsSync(outDir)) {
    fs.writeFileSync(path.join(outDir, ".nojekyll"), "");
    console.log("📄 تم إنشاء out/.nojekyll بنجاح.");

    // توليد 404.html ليدعم التوجيه على GitHub Pages
    const indexHtml = path.join(outDir, "index.html");
    const notFoundHtml = path.join(outDir, "404.html");
    if (fs.existsSync(indexHtml) && !fs.existsSync(notFoundHtml)) {
      fs.copyFileSync(indexHtml, notFoundHtml);
      console.log("📄 تم نسخ out/404.html لدعم التوجيه.");
    }

    // نسخ إلى مجلد dist أيضاً لتطابق التسميات
    const distDir = path.join(root, "dist");
    try {
      if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true });
      }
      fs.cpSync(outDir, distDir, { recursive: true });
      console.log("📄 تم تحديث مجلد dist/ بنجاح مطابقاً لـ out/.");
    } catch (e) {
      console.warn("تعذر نسخ dist:", e);
    }
  }

  console.log("\n🎉 جاهز! المجلد out/ جاهز للنشر على GitHub Pages.");
} catch (error) {
  console.error("❌ فشل بناء النسخة الثابتة:", error);
  buildFailed = true;
} finally {
  if (apiMoved && fs.existsSync(tempApiDir)) {
    console.log("🔄 إعادة مجلد src/app/api إلى مكانه الأصلي...");
    fs.renameSync(tempApiDir, apiDir);
    console.log("✅ تمت استعادة مسارات الـ API.");
  }
}

if (buildFailed) {
  process.exit(1);
}
