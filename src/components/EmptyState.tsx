// حالة الفراغ الموحّدة: أيقونة بسيطة بلون --color-tan + جملة قصيرة.
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 text-center">
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ color: "var(--color-tan)" }}
      >
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
    </div>
  );
}