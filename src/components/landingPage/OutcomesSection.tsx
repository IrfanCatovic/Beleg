import { useTranslation } from "react-i18next";

function IconHand(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22a9 9 0 1 0-9-9" />
      <path d="M3 13l3-3 3 3" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconClipboardCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

function IconCreditCard(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </svg>
  );
}

function IconCalendar(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconUsers(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconShieldCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export default function OutcomesSection() {
  const { t } = useTranslation("landing");

  const cards = [
    { key: "manualWork", Icon: IconHand },
    { key: "lostSignups", Icon: IconClipboardCheck },
    { key: "payments", Icon: IconCreditCard },
    { key: "trips", Icon: IconCalendar },
    { key: "members", Icon: IconUsers },
    { key: "financeErrors", Icon: IconShieldCheck },
  ] as const;

  return (
    <section className="bg-slate-50 border-y border-slate-100 py-14 sm:py-20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
        <div className="max-w-3xl mb-10 sm:mb-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {t("outcomesSection.badge")}
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight mb-4">
            {t("outcomesSection.title")}
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            {t("outcomesSection.subtitle")}
          </p>
        </div>

        <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ key, Icon }) => (
            <article
              key={key}
              className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all"
            >
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 mb-4">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-2 leading-snug">
                {t(`outcomesSection.cards.${key}.title`)}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t(`outcomesSection.cards.${key}.text`)}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 sm:mt-16 rounded-2xl bg-emerald-600 text-white px-5 sm:px-8 py-6 sm:py-8 shadow-md">
          <div className="max-w-3xl">
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mb-2">
              {t("outcomesSection.highlight.title")}
            </h3>
            <p className="text-sm sm:text-base text-emerald-50/95 leading-relaxed">
              {t("outcomesSection.highlight.text")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
