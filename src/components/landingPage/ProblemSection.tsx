import { useTranslation } from "react-i18next";

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

function IconInbox(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </svg>
  );
}

function IconCalculator(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="12" x2="8" y2="12" />
      <line x1="12" y1="12" x2="12" y2="12" />
      <line x1="16" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="12" y1="16" x2="12" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  );
}

function IconChart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 4 4 5-6" />
    </svg>
  );
}

export default function ProblemSection() {
  const { t } = useTranslation("landing");

  const cards = [
    { key: "members", Icon: IconUsers },
    { key: "signups", Icon: IconInbox },
    { key: "payments", Icon: IconCalculator },
    { key: "overview", Icon: IconChart },
  ] as const;

  return (
    <section className="bg-slate-50/80 border-y border-slate-100 py-16 sm:py-24">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
        <div className="max-w-3xl mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight mb-4">
            {t("problemSection.title")}
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            {t("problemSection.subtitle")}
          </p>
        </div>

        <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ key, Icon }) => (
            <article
              key={key}
              className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-emerald-200 hover:-translate-y-0.5 transition-all"
            >
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 mb-4">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-2 leading-snug">
                {t(`problemSection.cards.${key}.title`)}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t(`problemSection.cards.${key}.text`)}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10 sm:mt-12 rounded-2xl border-l-4 border-emerald-500 bg-white px-5 sm:px-6 py-4 sm:py-5 shadow-sm">
          <p className="text-sm sm:text-base text-slate-800 leading-relaxed">
            {t("problemSection.conclusion")}
          </p>
        </div>
      </div>
    </section>
  );
}
