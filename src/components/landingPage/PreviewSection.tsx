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

function BrowserFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-xl overflow-hidden ring-1 ring-slate-200 shadow-md bg-white">
      <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-300" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-300" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-300" aria-hidden="true" />
      </div>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full h-auto block"
      />
    </div>
  );
}

export default function PreviewSection() {
  const { t } = useTranslation("landing");

  return (
    <section className="bg-gradient-to-b from-white via-emerald-50/30 to-white py-14 sm:py-20 border-b border-slate-100">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10">
        <div className="max-w-3xl mb-10 sm:mb-12">
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

        <div className="grid gap-5 sm:gap-6 lg:gap-8 sm:grid-cols-2">
          {BLOCKS.map(({ key, src }) => (
            <article
              key={key}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all"
            >
              <BrowserFrame src={src} alt={t(`previewSection.blocks.${key}.alt`)} />

              <div className="pt-5 sm:pt-6 px-1 sm:px-2 pb-1">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-2 leading-snug">
                  {t(`previewSection.blocks.${key}.title`)}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {t(`previewSection.blocks.${key}.text`)}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 sm:mt-16 max-w-3xl">
          <p className="text-base sm:text-lg text-slate-800 leading-relaxed font-medium border-l-4 border-emerald-500 pl-5">
            {t("previewSection.conclusion")}
          </p>
        </div>
      </div>
    </section>
  );
}
