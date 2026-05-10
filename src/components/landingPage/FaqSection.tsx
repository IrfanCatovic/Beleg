import { useState } from "react";
import { useTranslation } from "react-i18next";

const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5"] as const;
type FaqKey = (typeof FAQ_KEYS)[number];

function IconChevron(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function FaqSection() {
  const { t } = useTranslation("landing");
  const [openId, setOpenId] = useState<FaqKey | null>("q1");

  function toggle(id: FaqKey) {
    setOpenId((current) => (current === id ? null : id));
  }

  return (
    <section className="bg-white py-16 sm:py-24 border-b border-slate-100">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
        <div className="max-w-3xl mb-10 sm:mb-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {t("faqSection.badge")}
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight mb-4">
            {t("faqSection.title")}
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            {t("faqSection.subtitle")}
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
          {FAQ_KEYS.map((key) => {
            const isOpen = openId === key;
            const panelId = `faq-panel-${key}`;
            const buttonId = `faq-button-${key}`;
            return (
              <div
                key={key}
                className={[
                  "rounded-xl border bg-white shadow-sm transition-colors",
                  isOpen
                    ? "border-emerald-300 shadow-emerald-900/5"
                    : "border-slate-200 hover:border-slate-300",
                ].join(" ")}
              >
                <button
                  id={buttonId}
                  type="button"
                  onClick={() => toggle(key)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 text-left focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:rounded-xl"
                >
                  <span className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                    {t(`faqSection.items.${key}.q`)}
                  </span>
                  <IconChevron
                    className={[
                      "h-5 w-5 shrink-0 transition-transform duration-200",
                      isOpen ? "rotate-180 text-emerald-600" : "text-slate-500",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={[
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  ].join(" ")}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 sm:px-6 pb-5 sm:pb-6 pt-0 text-sm sm:text-base text-slate-600 leading-relaxed">
                      {t(`faqSection.items.${key}.a`)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
