import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const BENEFIT_KEYS = ["b1", "b2", "b3", "b4", "b5", "b6"] as const;

function IconCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 7L10 17L4 11" />
    </svg>
  );
}

export default function FreeStartSection() {
  const { t } = useTranslation("landing");

  return (
    <section className="bg-white py-14 sm:py-20 border-b border-slate-100">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
        <div className="max-w-3xl mb-8 sm:mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {t("freeStartSection.badge")}
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight mb-4">
            {t("freeStartSection.title")}
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            {t("freeStartSection.subtitle")}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-6 sm:p-8 lg:p-10 shadow-sm">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-5 sm:mb-6">
            {t("freeStartSection.offerTitle")}
          </h3>

          <ul className="space-y-3 sm:space-y-3.5 mb-6 sm:mb-8">
            {BENEFIT_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-3 text-sm sm:text-base text-slate-700">
                <span className="mt-0.5 shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <IconCheck className="h-3 w-3" />
                </span>
                <span>{t(`freeStartSection.benefits.${key}`)}</span>
              </li>
            ))}
          </ul>

          <p className="text-sm text-slate-600 leading-relaxed mb-6 sm:mb-8 max-w-2xl">
            {t("freeStartSection.note")}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Link
              to="/kontakt"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full text-sm sm:text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/25 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              {t("freeStartSection.primaryCta")}
            </Link>
            <Link
              to="/kontakt"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full text-sm sm:text-base font-semibold text-slate-800 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300/60"
            >
              {t("freeStartSection.secondaryCta")}
            </Link>
          </div>
        </div>

        <div className="mt-10 sm:mt-12 max-w-3xl">
          <p className="text-base sm:text-lg text-slate-800 leading-relaxed font-medium border-l-4 border-emerald-500 pl-5">
            {t("freeStartSection.conclusion")}
          </p>
        </div>
      </div>
    </section>
  );
}
