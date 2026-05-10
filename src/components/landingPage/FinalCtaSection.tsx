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

  function handleSeeHow() {
    if (location.pathname === "/") {
      scrollToHowSection();
      return;
    }
    navigate("/");
    let attempts = 0;
    function tick() {
      const el = document.getElementById("landing-kako-radi");
      if (el) {
        scrollToHowSection();
        return;
      }
      attempts += 1;
      if (attempts < 60) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 py-20 sm:py-28">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 45% at 50% -10%, rgb(16 185 129 / 0.28), transparent 60%)",
        }}
      />
      <svg
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-32 sm:h-40 w-full text-emerald-500/10"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M0 200 L100 130 L220 165 L340 100 L470 150 L600 90 L730 145 L860 110 L990 155 L1120 120 L1200 145 L1200 200 Z"
        />
      </svg>
      <svg
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-24 sm:h-28 w-full text-emerald-400/10"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M0 200 L120 160 L260 180 L400 140 L540 175 L680 145 L820 180 L960 150 L1080 175 L1200 160 L1200 200 Z"
        />
      </svg>

      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-white/5 backdrop-blur-sm px-3 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200 mb-5 sm:mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            {t("finalCtaSection.badge")}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight mb-5 sm:mb-6">
            {t("finalCtaSection.title")}
          </h2>
          <p className="text-base sm:text-lg text-emerald-50/85 leading-relaxed mb-8 sm:mb-10 max-w-2xl mx-auto">
            {t("finalCtaSection.subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center mb-6 sm:mb-8">
            <Link
              to="/kontakt"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-sm sm:text-base font-semibold text-emerald-700 bg-white hover:bg-emerald-50 shadow-xl shadow-emerald-900/40 transition-colors focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              {t("finalCtaSection.primaryCta")}
            </Link>
            <button
              type="button"
              onClick={handleSeeHow}
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-sm sm:text-base font-semibold text-white bg-white/0 border border-white/40 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              {t("finalCtaSection.secondaryCta")}
            </button>
          </div>

          <p className="text-sm sm:text-base text-emerald-100/70 leading-relaxed max-w-2xl mx-auto mb-12 sm:mb-16">
            {t("finalCtaSection.noteUnderButtons")}
          </p>

          <ul className="grid gap-4 sm:grid-cols-3 text-left sm:gap-5 mb-12 sm:mb-16 list-none p-0 m-0">
            {POINT_KEYS.map((key) => (
              <li
                key={key}
                className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-4 sm:px-5 sm:py-5"
              >
                <p className="text-sm font-semibold text-white mb-1.5">
                  {t(`finalCtaSection.points.${key}.title`)}
                </p>
                <p className="text-xs sm:text-sm text-emerald-50/80 leading-relaxed">
                  {t(`finalCtaSection.points.${key}.desc`)}
                </p>
              </li>
            ))}
          </ul>

          <p className="text-lg sm:text-xl font-medium text-white leading-relaxed max-w-2xl mx-auto">
            {t("finalCtaSection.closingLine")}
          </p>
        </div>
      </div>
    </section>
  );
}
