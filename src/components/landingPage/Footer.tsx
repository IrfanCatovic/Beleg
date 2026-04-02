import { useTranslation } from "react-i18next";

export default function Footer() {
const { t } = useTranslation('landing')
return(<footer className="border-t border-slate-700/50 bg-slate-900 text-slate-200">
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10 py-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <img src="/LogoP.jpg" alt={t('common:appName')} className="h-8 w-8 rounded-lg" />
          <div>
            <p className="text-sm font-semibold text-white">{t('common:appName')}</p>
            <p className="text-[11px] text-slate-400">{t('footer.byline')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-5 text-xs text-slate-400 justify-center sm:justify-end">
          <a href="#hero" className="hover:text-white transition-colors">
            {t('footer.about')}
          </a>
          <a href="#features" className="hover:text-white transition-colors">
            {t('footer.features')}
          </a>
          <a href="/kontakt" className="hover:text-white transition-colors">
            {t('footer.contact')}
          </a>
          <button
            type="button"
            className="hover:text-white transition-colors"
          >
            {t('footer.privacy')}
          </button>
        </div>
      </div>
      <div className="mt-6 pt-4 border-t border-slate-800 text-center sm:text-left">
        <p className="text-[11px] text-slate-500 mb-2">
          {t('footer.copy', { year: new Date().getFullYear() })}
        </p>
        <p className="text-[11px] text-slate-500">{t('footer.demoCreds')}</p>
      </div>
    </div>
  </footer>)}
