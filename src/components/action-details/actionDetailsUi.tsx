export function StatCell({ icon, value, unit, label }: { icon: React.ReactNode; value: string; unit?: string; label: string }) {
  return (
    <div className="flex flex-col items-center py-4 gap-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-sm sm:text-base font-extrabold text-gray-900 leading-none">
          {value}
          {unit && <span className="text-xs font-semibold text-emerald-500 ml-0.5">{unit}</span>}
        </span>
      </div>
      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{label}</p>
    </div>
  )
}

export function HeroMini({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: 'sky' | 'amber' | 'indigo' | 'violet' | 'emerald'
}) {
  const palette: Record<string, { bg: string; text: string; ring: string; iconBg: string }> = {
    sky: { bg: 'bg-sky-50/80', text: 'text-sky-700', ring: 'ring-sky-100', iconBg: 'bg-sky-100 text-sky-600' },
    amber: { bg: 'bg-amber-50/80', text: 'text-amber-700', ring: 'ring-amber-100', iconBg: 'bg-amber-100 text-amber-600' },
    indigo: { bg: 'bg-indigo-50/80', text: 'text-indigo-700', ring: 'ring-indigo-100', iconBg: 'bg-indigo-100 text-indigo-600' },
    violet: { bg: 'bg-violet-50/80', text: 'text-violet-700', ring: 'ring-violet-100', iconBg: 'bg-violet-100 text-violet-600' },
    emerald: { bg: 'bg-emerald-50/80', text: 'text-emerald-700', ring: 'ring-emerald-100', iconBg: 'bg-emerald-100 text-emerald-600' },
  }
  const c = palette[color]
  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ring-1 ${c.bg} ${c.ring}`}>
      <div className={`shrink-0 w-8 h-8 rounded-lg ${c.iconBg} flex items-center justify-center`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500 leading-none">{label}</p>
        <p className={`text-sm font-extrabold ${c.text} leading-tight mt-0.5 truncate`}>{value}</p>
      </div>
    </div>
  )
}

export function InfoRow({ icon, iconBg, label, value }: { icon: React.ReactNode; iconBg: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`shrink-0 h-9 w-9 rounded-xl ${iconBg} flex items-center justify-center`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  )
}
