import { lazy } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

const Experience = lazy(() => import('./Experience.jsx'))
const GameScreen = lazy(() => import('./game/GameScreen.jsx'))

// /experience opens in show mode: the party game (ALIBI.EXE) runs first on the big screen, and
// when it ends the game hands over to the 360° view on this same address (the handoff arrives as
// router state). /experience?explore skips the game and opens the view straight away, as it used to.
export default function ExperienceShow() {
  const handoff = useLocation().state?.handoff
  const [params] = useSearchParams()
  if (handoff || params.has('explore')) return <Experience />
  return <GameScreen show />
}
