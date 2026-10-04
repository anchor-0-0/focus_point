import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { networkInterfaces } from "os";
import { requireAdminJson } from "@/lib/admin-require";

export const dynamic = "force-dynamic";

type DetectedAddress = {
  name: string;
  ip: string;
};

// أسماء نمطية لمحولات افتراضية (Hyper-V/VMware/VPN/تجاوز الشبكات) لا تصل
// إليها أجهزة الشبكة الحقيقية — تُؤخر في الترتيب ولا تُتخذ افتراضية افتراضياً،
// مع بقائها ظاهرة في القائمة لاختيار صاحب المكان.
const VIRTUAL_NAME = /vEthernet|VMware|VirtualBox|Hyper-V|Default Switch|Hamachi|Tailscale|WireGuard|TAP-|TAP |ProTUN|tun|zt\b/i;

function isLikelyVirtual(name: string): boolean {
  return VIRTUAL_NAME.test(name);
}

// اكتشاف كل واجهات الشبكة النشطة ذات IPv4 غير داخلي (تجاهل 127.0.0.1 وغيره).
function detectIPv4(): DetectedAddress[] {
  const physical: DetectedAddress[] = [];
  const virtual: DetectedAddress[] = [];
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name];
    if (!nets) continue;
    for (const net of nets) {
      if (!net.internal && net.family === "IPv4") {
        (isLikelyVirtual(name) ? virtual : physical).push({ name, ip: net.address });
      }
    }
  }
  return [...physical, ...virtual];
}

// المنفذ الحقيقي اللي يعمل عليه السيرفر: يُقرأ من هيدر Host الخاص بالطلب
// (يعكس المنفذ اللي اتصل عليه المتصفح)، ثم PORT البيئي، ثم افتراضياً 3000.
function detectPort(req: NextRequest): number {
  const host = req.headers.get("host") ?? "";
  const parsed = Number(host.split(":")[1]);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  const env = Number(process.env.PORT);
  return Number.isInteger(env) && env > 0 ? env : 3000;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const addresses = detectIPv4();
  const port = detectPort(req);

  const fallback =
    process.env.NEXT_PUBLIC_CHECKIN_URL?.trim() ||
    `http://localhost:${port}/checkin`;

  // إن فتح الأدمن الصفحة بعنوان IP فعلي فهو المرشح الأرجح؛ وإلا تُفضَّل أول
  // واجهة فيزيائية (Wi-Fi/Ethernet) على المحولات الافتراضية غير الوصولية.
  const hostHeader = req.headers.get("host") ?? "";
  const hostIp = hostHeader.split(":")[0];
  const matched = addresses.find((a) => a.ip === hostIp);
  const preferred =
    matched?.ip ?? addresses.find((a) => !isLikelyVirtual(a.name))?.ip ?? addresses[0]?.ip ?? null;

  return NextResponse.json({
    addresses,
    port,
    fallback,
    preferred,
  });
}