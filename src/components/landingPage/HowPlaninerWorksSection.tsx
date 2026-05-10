import { useTranslation } from "react-i18next";

const STEP_KEYS = ["s1", "s2", "s3", "s4", "s5"] as const;

export default function HowPlaninerWorksSection() {
  const { t } = useTranslation("landing");

  return (
    <section className="bg-white py-16 sm:py-24 border-b border-slate-100">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
        <div className="max-w-3xl mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight mb-4">
            {t("howPlaninerWorksSection.title")}
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            {t("howPlaninerWorksSection.subtitle")}
          </p>
        </div>

        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5 list-none p-0 m-0">
          {STEP_KEYS.map((key, index) => (
            <li
              key={key}
              className="relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm hover:border-emerald-200 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <span
                className="mb-4 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold tracking-tight text-white tabular-nums"
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="text-base font-semibold text-slate-900 mb-2 leading-snug">
                {t(`howPlaninerWorksSection.steps.${key}.title`)}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed grow">
                {t(`howPlaninerWorksSection.steps.${key}.text`)}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-12 sm:mt-16 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-5 sm:px-8 py-6 sm:py-8">
          <div className="max-w-3xl">
            <h3 className="text-lg sm:text-xl font-bold text-emerald-900 mb-2">
              {t("howPlaninerWorksSection.highlight.title")}
            </h3>
            <p className="text-sm sm:text-base text-emerald-900/85 leading-relaxed">
              {t("howPlaninerWorksSection.highlight.text")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
