// Building blocks for detail side drawers (Sheet)

export function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4 px-4 py-2.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right font-medium min-w-0 break-words">{value ?? '—'}</span>
    </div>
  );
}

export function DetailSection({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        {title}
      </p>
      <div className="rounded-lg border bg-card divide-y">{children}</div>
    </div>
  );
}
