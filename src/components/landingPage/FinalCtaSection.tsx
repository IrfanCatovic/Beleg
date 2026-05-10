import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const POINT_KEYS = ["p1", "p2", "p3"] as const;

function scrollToHowSection() {
  const el = document.getElementById("landing-kako-radi");
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function FinalCtaSection() {
  const { t } = useTranslation("landing");
  const navigate = useNavigate();
  const location = useLocation();

  const handleSeeHow = () => {
    if (location.pathname === "/") {
      scrollToHowSection();
      return;
    }
    navigate("/");
    let attempts = 0;
    const tick = () => {
      const el = document.getElementById("landing-kako-radi");
      if (el) {
        scrollToHowSection();
        return;
      }
      attempts += 1;
      if (attempts < 60) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  return (
    <section className="relative overflow-hidden border-b border-emerald-100/80 bg-gradient-to-b from-emerald-50 via-white to-emerald-50/30 py-16 sm:py-24">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgb(16 185 129 / 0.18), transparent 55%)",
        }}
      />
      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800 mb-5 sm:mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {t("finalCtaSection.badge")}
          </span>
          <h2 className="text-2xl sm:text-4xl lg:text-[2.5rem] font-extrabold text-slate-900 leading-tight tracking-tight mb-4 sm:mb-5">
            {t("finalCtaSection.title")}
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-8 sm:mb-10">
            {t("finalCtaSection.subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center mb-6 sm:mb-8">
            <Link
              to="/kontakt"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-sm sm:text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/25 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              {t("finalCtaSection.primaryCta")}
            </Link>
            <button
              type="button"
              onClick={handleSeeHow}
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-sm sm:text-base font-semibold text-slate-800 bg-white border border-slate-300 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300/60"
            >
              {t("finalCtaSection.secondaryCta")}
            </button>
          </div>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto mb-10 sm:mb-14">
            {t("finalCtaSection.noteUnderButtons")}
          </p>

          <ul className="grid gap-4 sm:grid-cols-3 text-left sm:gap-5 mb-10 sm:mb-14 list-none p-0 m-0">
            {POINT_KEYS.map((key) => (
              <li
                key={key}
                className="rounded-xl border border-slate-200/90 bg-white/70 backdrop-blur-sm px-4 py-4 sm:px-5 sm:py-5 shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-900 mb-1.5">
                  {t(`finalCtaSection.points.${key}.title`)}
                </p>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {t(`finalCtaSection.points.${key}.desc`)}
                </p>
              </li>
            ))}
          </ul>

          <p className="text-base sm:text-lg font-medium text-slate-800 leading-relaxed max-w-2xl mx-auto">
            {t("finalCtaSection.closingLine")}
          </p>
        </div>
      </div>
    </section>
  );
}
