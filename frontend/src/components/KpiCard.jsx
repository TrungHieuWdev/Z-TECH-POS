export default function KpiCard({
  icon: Icon,
  label,
  value,
  detail,
  toneClassName = 'bg-sky-50 text-sky-700',
  onClick,
  title,
  className = ''
}) {
  const Wrapper = onClick ? 'button' : 'article';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title || label}
      className={`min-h-32 w-full border border-slate-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md ${onClick ? 'focus:outline-none focus:ring-2 focus:ring-sky-200' : ''} ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate pt-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</p>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${toneClassName}`}>
          <Icon size={18} strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-3 truncate text-3xl font-bold tabular-nums tracking-tight text-slate-950">
        {value}
      </p>
      <div className="mt-2 flex min-h-6 items-center text-[11px] font-semibold text-slate-500">
        {detail || '\u00A0'}
      </div>
    </Wrapper>
  );
}
