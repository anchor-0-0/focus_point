import { prisma } from "../src/lib/prisma";
import { readdir, stat, unlink } from "node:fs/promises";
import * as path from "node:path";
import { getUploadsDir, resolveStoredPath } from "../src/lib/uploads";

// ============================================================
// أدوات تنظيف ملفات الطباعة
// ------------------------------------------------------------
// يقوم بحذف كل ملف (uuid.امتداد) مرتبط بطلبات طباعة "منجزة" (done)
// أقدم من GLOBAL_MAX_AGE_DAYS يوماً، سواء في قاعدة البيانات أو على
// القرص إذا لم يعد مرتبطاً بأي طلب pending/chrono_canceled.
// يركَض يدوياً من وحدة التحكم فقط — لا يُجدوَل.
// ============================================================

const GLOBAL_MAX_AGE_DAYS = 7;

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("الاستخدام: npm run cleanup:uploads");
  console.log(`يحذف ملفات طلبات الطباعة المنجزة أقدم من ${GLOBAL_MAX_AGE_DAYS} يوماً.`);
  process.exit(0);
}

async function getAllStoredFileNames(): Promise<string[]> {
  const dir = path.resolve(getUploadsDir());
  const entries = await readdir(dir);
  const result: string[] = [];
  for (const entry of entries) {
    const full = path.resolve(dir, entry);
    const info = await stat(full);
    if (info.isFile()) result.push(entry);
  }
  return result;
}

async function run(customDays: number): Promise<void> {
  const cutoff = new Date(Date.now() - customDays * 24 * 60 * 60 * 1000);

  const doneOrders = await prisma.order.findMany({
    where: { status: "done" },
    select: { id: true, createdAt: true, details: true },
  });

  let cleaned = 0;
  const release: string[] = [];

  for (const order of doneOrders) {
    const details = order.details as { file_path?: string } | null;
    const fileName = details?.file_path;
    if (!fileName) continue;

    if (order.createdAt <= cutoff) {
      try {
        await unlink(path.resolve(resolveStoredPath(fileName)));
        release.push(fileName);
        cleaned++;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") {
          console.error(`تعذّر حذف ${fileName}:`, err);
        }
      }
    }
  }

  // أي ملفات متبقية على القرص لا يشير إليها أي طلب نشط (للاحتياط).
  const activePaths = new Set(
    (
      await prisma.order.findMany({
        where: {
          status: { in: ["pending", "processed", "done"] },
        },
        select: { details: true },
      })
    )
      .map((o) => (o.details as { file_path?: string } | null)?.file_path)
      .filter((p): p is string => !!p)
  );

  const onDisk = await getAllStoredFileNames();
  const orphaned = onDisk.filter((name) => !activePaths.has(name) && !release.includes(name));
  for (const name of orphaned) {
    try {
      await unlink(resolveStoredPath(name));
      cleaned++;
      release.push(name);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        console.error(`تعذّر حذف الملف المتشرد ${name}:`, err);
      }
    }
  }

  console.log(
    `اكتمل. حُذفت ${cleaned} ملفاً (أقدم من ${customDays} يوماً وما تخلّى عنه الطلبات النشطة).`
  );
  if (release.length) console.log("الملفات المحذوفة:", release.join(", "));
}

const givenDays = Number(process.argv[process.argv.indexOf("--days") + 1]);
const days = Number.isInteger(givenDays) && givenDays > 0 ? givenDays : GLOBAL_MAX_AGE_DAYS;

run(days)
  .catch((err) => {
    console.error("فشل التنظيف:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });