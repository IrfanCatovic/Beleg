// Lokalne slike zamenjene Cloudinary URL-ovima direktno u JSX
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import HeroLanding from '../../components/landingPage/HeroLanding'
import ProblemSection from '../../components/landingPage/ProblemSection'
import SolutionSection from '../../components/landingPage/SolutionSection'
import AudienceSection from '../../components/landingPage/AudienceSection'
import HowPlaninerWorksSection from '../../components/landingPage/HowPlaninerWorksSection'
import PreviewSection from '../../components/landingPage/PreviewSection'
import Footer from '../../components/landingPage/Footer'

function IconCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 text-emerald-600"
      {...props}
    >
      <path
        d="M20 7L10 17L4 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconSparkles(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 text-yellow-500"
      {...props}
    >
      <path
        d="M5 3L6.5 7.5L11 9L6.5 10.5L5 15L3.5 10.5L-1 9L3.5 7.5L5 3Z"
        transform="translate(8 1)"
        fill="currentColor"
      />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="18" cy="8" r="1.2" fill="currentColor" />
    </svg>
  )
}

export default function Landing() {

  const navigate = useNavigate()
  const { t } = useTranslation('landing')
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      
      <HeroLanding />
      {/* Mountain band segment sa porukom */}
      <section className="relative w-full bg-slate-900 text-white">
        <div className="relative w-full h-56 sm:h-72 md:h-80 lg:h-96 overflow-hidden">
          <img
            src="https://res.cloudinary.com/dfvxp5rza/image/upload/v1773786066/planinski_pejza%C5%BE_vpdfmb.jpg"
            alt={t('alts.mountainLandscape')}
            className="w-full h-full object-cover"
            style={{ objectPosition: 'center center' }}
          />

          {/* Tamni overlay za čitljiv tekst */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/30 to-slate-900/80" />

          {/* Tekst preko slike */}
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="max-w-3xl text-center">
              <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-emerald-200 mb-3">
                {t('mountainBand.badge')}
              </p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3 sm:mb-4 leading-snug">
                {t('mountainBand.title')}
              </h2>
              <p className="text-sm sm:text-base text-slate-100 max-w-2xl mx-auto">
                {t('mountainBand.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Donji cik-cak border prema sledećem delu (belom) */}
        <div className="absolute -bottom-6 left-0 right-0 h-6 overflow-hidden text-white">
          <svg
            viewBox="0 0 100 10"
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            <polygon
              fill="white"
              points="0,0 0,10 5,5 10,10 15,5 20,10 25,5 30,10 35,5 40,10 45,5 50,10 55,5 60,10 65,5 70,10 75,5 80,10 85,5 90,10 95,5 100,10 100,0"
            />
          </svg>
        </div>
      </section>
      <ProblemSection />
      <SolutionSection />
      <AudienceSection />
      <HowPlaninerWorksSection />
      <PreviewSection />
      

      

     
      {/* Footer */}
      <Footer />
    </div>
  )
}

