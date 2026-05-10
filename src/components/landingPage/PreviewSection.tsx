import { useTranslation } from "react-i18next";

type Block = {
  key: "members" | "actions" | "signups" | "finance";
  src: string;
};

const BLOCKS: ReadonlyArray<Block> = [
  {
    key: "members",
    src: "https://res.cloudinary.com/dfvxp5rza/image/upload/v1774599671/profil1_cdpfbc.png",
  },
  {
    key: "actions",
    src: "https://res.cloudinary.com/dfvxp5rza/image/upload/v1774599673/akcije1_oj61lo.png",
  },
  {
    key: "signups",
    src: "/ActionDetails.png",
  },
  {
    key: "finance",
    src: "https://res.cloudinary.com/dfvxp5rza/image/upload/v1774599654/finansije1_hr2nix.png",
  },
];

const BULLET_KEYS = ["b1", "b2"] as const;

function IconCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 7L10 17L4 11" />
    </svg>
  );
}

function BrowserFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-2xl overflow-hidden ring-1 ring-slate-200 shadow-xl shadow-emerald-900/5 bg-white">
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-300" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-300" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-300" aria-hidden="true" />
      </div>
      <div className="bg-gradient-to-br from-slate-50 to-emerald-50/40">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="w-full h-auto block"
        />
      </div>
    </div>
  );
}

export default function PreviewSection() {
  const { t } = useTranslation("landing");

  return (
    <section className="bg-slate-50 py-16 sm:py-24 border-y border-slate-100">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
        <div className="max-w-3xl mb-12 sm:mb-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {t("previewSection.badge")}
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight mb-4">
            {t("previewSection.title")}
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            {t("previewSection.subtitle")}
          </p>
        </div>

        <div className="space-y-14 sm:space-y-20">
          {BLOCKS.map(({ key, src }, index) => {
            const reverse = index % 2 === 1;
            return (
              <article
                key={key}
                className="grid gap-8 lg:gap-14 md:grid-cols-2 items-center"
              >
                <div
                  className={[
                    "max-w-xl",
                    reverse ? "md:order-2 md:ml-auto" : "md:order-1",
                  ].join(" ")}
                >
                  <BrowserFrame src={src} alt={t(`previewSection.blocks.${key}.alt`)} />
                </div>

                <div
                  className={[
                    "max-w-xl",
                    reverse ? "md:order-1" : "md:order-2",
                  ].join(" ")}
                >
                  <span className="inline-flex items-center justify-center text-[11px] font-bold text-emerald-700 bg-emerald-100 rounded-full h-7 w-7 mb-4 tabular-nums">
                    0{index + 1}
                  </span>
                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 leading-tight tracking-tight mb-3">
                    {t(`previewSection.blocks.${key}.title`)}
                  </h3>
                  <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-5">
                    {t(`previewSection.blocks.${key}.text`)}
                  </p>
                  <ul className="space-y-2.5">
                    {BULLET_KEYS.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-3 text-sm sm:text-base text-slate-700"
                      >
                        <span className="mt-0.5 shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                          <IconCheck className="h-3 w-3" />
                        </span>
                        <span>
                          {t(`previewSection.blocks.${key}.bullets.${b}`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-16 sm:mt-20 max-w-3xl">
          <p className="text-base sm:text-lg text-slate-800 leading-relaxed font-medium border-l-4 border-emerald-500 pl-5">
            {t("previewSection.conclusion")}
          </p>
        </div>
      </div>
    </section>
  );
}
