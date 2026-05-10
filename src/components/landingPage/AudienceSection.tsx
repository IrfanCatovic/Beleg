import { useTranslation } from "react-i18next";

function IconShield(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconCompass(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function IconWallet(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
      <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
      <circle cx="18" cy="14" r="1" />
    </svg>
  );
}

function IconCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 7L10 17L4 11" />
    </svg>
  );
}

export default function AudienceSection() {
  const { t } = useTranslation("landing");

  const cards = [
    { key: "leadership", Icon: IconShield },
    { key: "guides", Icon: IconCompass },
    { key: "treasurers", Icon: IconWallet },
  ] as const;

  return (
    <section className="bg-slate-50 border-y border-slate-100 py-14 sm:py-20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
        <div className="max-w-3xl mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight mb-4">
            {t("audienceSection.title")}
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            {t("audienceSection.subtitle")}
          </p>
        </div>

        <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ key, Icon }) => (
            <article
              key={key}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all"
            >
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-50 text-emerald-700 mb-5">
                <Icon className="h-6 w-6" />
              </div>

              <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-3 leading-snug">
                {t(`audienceSection.cards.${key}.title`)}
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed mb-5">
                {t(`audienceSection.cards.${key}.text`)}
              </p>

              <ul className="mt-auto space-y-2 pt-4 border-t border-slate-100">
                {(["b1", "b2", "b3", "b4"] as const).map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="shrink-0 mt-0.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-emerald-100 text-emerald-700">
                      <IconCheck className="h-3 w-3" />
                    </span>
                    <span>{t(`audienceSection.cards.${key}.benefits.${b}`)}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-12 sm:mt-16 max-w-3xl">
          <p className="text-base sm:text-lg text-slate-800 leading-relaxed font-medium border-l-4 border-emerald-500 pl-5">
            {t("audienceSection.conclusion")}
          </p>
        </div>
      </div>
    </section>
  );
}
