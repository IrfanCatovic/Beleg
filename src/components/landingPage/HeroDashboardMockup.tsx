type Kpi = {
  label: string;
  value: string;
  tone: "neutral" | "good" | "warn";
};

const KPIS: ReadonlyArray<Kpi> = [
  { label: "Ukupno članova", value: "128", tone: "neutral" },
  { label: "Aktivnih članova", value: "96", tone: "good" },
  { label: "Akcija ovog meseca", value: "4", tone: "neutral" },
  { label: "Neplaćenih članarina", value: "17", tone: "warn" },
];

type ActionRow = {
  name: string;
  date: string;
  signups: number;
};

const ACTIONS: ReadonlyArray<ActionRow> = [
  { name: "Uspon na Hajlu", date: "12. jun", signups: 32 },
  { name: "Tara — vikend akcija", date: "21. jun", signups: 18 },
  { name: "Rtanj", date: "5. jul", signups: 9 },
];

function IconUsers(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconCalendar(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconCash(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 10v4M18 10v4" />
    </svg>
  );
}

function IconHome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function IconUser(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function IconMountain(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 20l5-9 4 6 3-4 6 7Z" />
      <circle cx="9" cy="7" r="1.5" />
    </svg>
  );
}

function kpiTone(tone: Kpi["tone"]) {
  if (tone === "good") return "text-emerald-600";
  if (tone === "warn") return "text-amber-600";
  return "text-slate-900";
}

export default function HeroDashboardMockup() {
  return (
    <div
      className="relative w-full"
      role="img"
      aria-label="Pregled Planiner aplikacije: članovi, akcije i finansije"
    >
      <div className="relative rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl shadow-emerald-900/10 overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-200">
          <span className="h-2.5 w-2.5 rounded-full bg-red-300" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-300" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-300" aria-hidden="true" />
          <span className="ml-3 text-[11px] text-slate-500 font-mono truncate">
            planiner.app/klub/pd-hajla
          </span>
        </div>

        <div className="flex">
          <aside className="hidden sm:flex flex-col gap-1 w-40 shrink-0 border-r border-slate-200 bg-slate-50/60 p-3">
            <div className="flex items-center gap-2 px-2 py-2 mb-2">
              <span className="inline-flex h-7 w-7 rounded-lg bg-emerald-600 items-center justify-center">
                <IconMountain className="h-4 w-4 text-white" />
              </span>
              <div className="leading-tight">
                <p className="text-[11px] font-semibold text-slate-900">Planiner</p>
                <p className="text-[10px] text-slate-500">PD Hajla</p>
              </div>
            </div>
            {[
              { icon: IconHome, label: "Pregled", active: true },
              { icon: IconUsers, label: "Članovi" },
              { icon: IconCalendar, label: "Akcije" },
              { icon: IconCash, label: "Finansije" },
              { icon: IconUser, label: "Profil" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={[
                    "flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium",
                    item.active
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-600",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </div>
              );
            })}
          </aside>

          <div className="flex-1 min-w-0 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Pregled kluba
                </p>
                <p className="text-sm font-bold text-slate-900">PD Hajla — sezona 2026</p>
              </div>
              <span className="hidden sm:inline-flex h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center text-[11px] font-bold">
                MS
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-2.5 mb-3 sm:mb-4">
              {KPIS.map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                >
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-slate-500 font-medium leading-tight">
                    {kpi.label}
                  </p>
                  <p className={`text-lg sm:text-xl font-bold leading-tight tabular-nums ${kpiTone(kpi.tone)}`}>
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white mb-3 sm:mb-4">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                <p className="text-[12px] font-semibold text-slate-900">
                  Predstojeće akcije
                </p>
                <span className="text-[10px] text-slate-500">
                  {ACTIONS.length} aktivnih
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {ACTIONS.map((row) => (
                  <li
                    key={row.name}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-slate-900 truncate">
                        {row.name}
                      </p>
                      <p className="text-[10px] text-slate-500">{row.date}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-semibold text-slate-700 tabular-nums">
                        {row.signups} prijava
                      </span>
                      <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
                        Otvorena prijava
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-semibold text-slate-900">
                  Finansije
                </p>
                <p className="text-[11px] text-emerald-700 font-semibold tabular-nums">
                  +1 240 €
                </p>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                <span>Naplaćeno članarina</span>
                <span className="font-semibold text-slate-700 tabular-nums">79%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: "79%" }}
                />
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                Prihod akcija u sezoni
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="hidden lg:block absolute -bottom-6 -right-4 w-32 rounded-[1.4rem] bg-white ring-1 ring-slate-200 shadow-lg shadow-emerald-900/10 overflow-hidden p-2"
      >
        <div className="rounded-[1rem] bg-slate-50 p-2">
          <p className="text-[8px] uppercase tracking-wider text-slate-500 font-semibold">
            Prijave
          </p>
          <p className="text-[10px] font-bold text-slate-900 mb-2 leading-tight">
            Uspon na Hajlu
          </p>
          <div className="flex -space-x-1.5 mb-1.5">
            {["MS", "AJ", "PK", "DV"].map((initials, i) => (
              <span
                key={initials}
                className={[
                  "inline-flex h-5 w-5 rounded-full ring-2 ring-white items-center justify-center text-[7px] font-bold text-white",
                  ["bg-emerald-500", "bg-emerald-600", "bg-emerald-700", "bg-slate-400"][i],
                ].join(" ")}
              >
                {initials}
              </span>
            ))}
            <span className="inline-flex h-5 w-5 rounded-full ring-2 ring-white bg-slate-100 items-center justify-center text-[7px] font-bold text-slate-600">
              +28
            </span>
          </div>
          <p className="text-[8px] text-slate-500 leading-tight">
            32 prijave • 21 plaćeno
          </p>
        </div>
      </div>
    </div>
  );
}
