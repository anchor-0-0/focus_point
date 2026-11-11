/**
 * يُرجع المسار الكامل للملف مع مراعاة basePath على GitHub Pages (مثل /focus_point).
 */
export function assetPath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
