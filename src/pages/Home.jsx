import Hero from '../sections/home/Hero.jsx'
import Problem from '../sections/home/Problem.jsx'
import Approach from '../sections/home/Approach.jsx'
import Deals from '../sections/home/Deals.jsx'
import Founder from '../sections/home/Founder.jsx'
import Flagship from '../sections/home/Flagship.jsx'
import StreamingLessons from '../sections/home/StreamingLessons.jsx'
import Comparison from '../sections/home/Comparison.jsx'
import SubmitDemo from '../sections/home/SubmitDemo.jsx'
import FAQ from '../sections/home/FAQ.jsx'
import Platforms from '../sections/home/Platforms.jsx'
import FinalCTA from '../sections/home/FinalCTA.jsx'

// Sections render in this order. Reorder or remove here.
export default function Home() {
  return (
    <>
      <Hero />
      <Problem />
      <Approach />
      <Deals />
      <Founder />
      <Flagship />
      <StreamingLessons />
      <Comparison />
      <SubmitDemo />
      <FAQ />
      <Platforms />
      <FinalCTA />
    </>
  )
}
