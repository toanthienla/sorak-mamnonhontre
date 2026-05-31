export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-1.5 shrink-0">{actions}</div>}
    </div>
  );
}
