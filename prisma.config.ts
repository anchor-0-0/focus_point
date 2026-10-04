// ============================================================
// Prisma Config — Prisma 7
// إعدادات CLI (migrations, generate, db seed) تُوضع هنا.
// يقرأ DATABASE_URL من ملف .env.local (نفس الملف الذي يقرؤه
// Next.js) عبر dotenv — Prisma 7 لا يحمّل متغيرات البيئة تلقائياً.
// ============================================================
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma 7 لا يحمّل متغيرات البيئة تلقائياً. نقرأ .env.local —
// نفس الملف الذي يقرؤه Next.js — لنحتفظ بمصدر واحد للاتصال.
config({ path: ".env.local" });

export default defineConfig({
  // موقع ملف الـ schema (نسبي من جذر المشروع)
  schema: "prisma/schema.prisma",

  // موقع مجلد الـ migrations
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },

  // اتصال قاعدة البيانات — يُستخدم من قبل CLI (migrate/generate)
  datasource: {
    url: env("DATABASE_URL"),
  },
});