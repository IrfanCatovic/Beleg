import HeroLanding from '../../components/landingPage/HeroLanding'
import ProblemSection from '../../components/landingPage/ProblemSection'
import SolutionSection from '../../components/landingPage/SolutionSection'
import AudienceSection from '../../components/landingPage/AudienceSection'
import HowPlaninerWorksSection from '../../components/landingPage/HowPlaninerWorksSection'
import PreviewSection from '../../components/landingPage/PreviewSection'
import OutcomesSection from '../../components/landingPage/OutcomesSection'
import FreeStartSection from '../../components/landingPage/FreeStartSection'
import FaqSection from '../../components/landingPage/FaqSection'
import FinalCtaSection from '../../components/landingPage/FinalCtaSection'
import Footer from '../../components/landingPage/Footer'

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      <HeroLanding />
      <ProblemSection />
      <SolutionSection />
      <AudienceSection />
      <div id="landing-kako-radi" className="scroll-mt-20">
        <HowPlaninerWorksSection />
      </div>
      <PreviewSection />
      <OutcomesSection />
      <FreeStartSection />
      <FaqSection />
      <FinalCtaSection />
      <Footer />
    </div>
  )
}
