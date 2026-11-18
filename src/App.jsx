import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import SiteLayout from './components/layout/SiteLayout.jsx'
import AuthLayout from './components/layout/AuthLayout.jsx'
import ScrollToHash from './components/layout/ScrollToHash.jsx'
import PageMeta from './components/layout/PageMeta.jsx'
import ErrorBoundary from './components/layout/ErrorBoundary.jsx'
import Home from './pages/Home.jsx'
import Contact from './pages/Contact.jsx'
import Legal from './pages/Legal.jsx'
import NotFound from './pages/NotFound.jsx'

// Owner-only pages load lazily so Firebase stays out of the public bundle.
const AuthProvider = lazy(() => import('./components/auth/AuthProvider.jsx'))
const RequireOwner = lazy(() => import('./components/auth/RequireOwner.jsx'))
const AdminLayout = lazy(() => import('./components/layout/AdminLayout.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard.jsx'))
const Drive = lazy(() => import('./pages/admin/Drive.jsx'))
const Campaigns = lazy(() => import('./pages/admin/Campaigns.jsx'))
const Analytics = lazy(() => import('./pages/Analytics.jsx'))
const AdminTeam = lazy(() => import('./pages/admin/Team.jsx'))
const AdminExperience = lazy(() => import('./pages/admin/Experience.jsx'))
// The cloud video editor's live view fills the whole screen, so it sits outside the admin layout.
const Edit = lazy(() => import('./pages/Edit.jsx'))
const TeamLayout = lazy(() => import('./components/layout/TeamLayout.jsx'))
const TeamAccess = lazy(() => import('./components/team/TeamAccess.jsx'))
const Team = lazy(() => import('./pages/Team.jsx'))
const TeamMessages = lazy(() => import('./pages/TeamMessages.jsx'))
const TeamJoin = lazy(() => import('./pages/TeamJoin.jsx'))
const CrewLogin = lazy(() => import('./pages/CrewLogin.jsx'))
const CrewWelcome = lazy(() => import('./pages/CrewWelcome.jsx'))
const NoteBoard = lazy(() => import('./pages/note/NoteBoard.jsx'))
const TeamAssignments = lazy(() => import('./pages/TeamAssignments.jsx'))
// The hidden game loads lazily too: its country outlines are a large file.
const Global = lazy(() => import('./pages/Global.jsx'))
// The 360° view fills the whole screen, so it sits outside the site layout.
const Experience = lazy(() => import('./pages/Experience.jsx'))
const Controller = lazy(() => import('./pages/Controller.jsx'))
// ALIBI.EXE: the big screen (/game/join) and the phones (/game/play).
const GameScreen = lazy(() => import('./pages/game/GameScreen.jsx'))
const GamePlay = lazy(() => import('./pages/game/GamePlay.jsx'))

export default function App() {
  return (
    <>
      <ScrollToHash />
      <PageMeta />
      <ErrorBoundary>
      <Suspense fallback={null}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/roster" element={<Navigate to="/" replace />} />
            <Route path="/case-studies" element={<Navigate to="/" replace />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Legal doc="privacy" />} />
            <Route path="/terms" element={<Legal doc="terms" />} />
            <Route path="/global" element={<Global />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/experience" element={<Experience />} />
          <Route path="/experience/controller" element={<Controller />} />
          <Route path="/game/join" element={<GameScreen />} />
          <Route path="/game/play" element={<GamePlay />} />
          {/* Owner-only area: Google sign-in, restricted to ownerUid in data/firebase.js. */}
          <Route element={<AuthProvider />}>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
            </Route>
            <Route element={<RequireOwner />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<Dashboard />} />
                <Route path="/admin/drive" element={<Drive />} />
                <Route path="/admin/campaigns" element={<Campaigns />} />
                <Route path="/admin/team" element={<AdminTeam />} />
                <Route path="/admin/experience" element={<AdminExperience />} />
                <Route path="/analytics" element={<Analytics />} />
              </Route>
              <Route path="/edit" element={<Edit />} />
            </Route>
            {/* Team portal: Google sign-in, open to emails listed at /admin/team (checked in TeamAccess). */}
            {/* latest avenue note: boards the team edits; shared boards are readable by anyone with the link. */}
            {/* Crew: sign-in for people listed under Crew at /admin/team, then their welcome, then the boards (read-only). */}
            {/* Team sign-up: anyone can ask to join with Google; the owner approves at /admin/team. */}
            <Route path="/team/join" element={<TeamJoin />} />
            <Route path="/team/crew" element={<CrewLogin />} />
            <Route path="/team/note/welcome" element={<CrewWelcome />} />
            <Route path="/team/note" element={<NoteBoard />} />
            <Route path="/team/note/:boardId" element={<NoteBoard />} />
            <Route element={<TeamLayout />}>
              <Route element={<TeamAccess />}>
                <Route path="/team" element={<Team />} />
                <Route path="/team/chat" element={<TeamMessages />} />
                <Route path="/team/assignments" element={<TeamAssignments />} />
                <Route path="/team/assignments/:id" element={<Navigate to="/team/assignments" replace />} />
              </Route>
            </Route>
          </Route>
          <Route path="/team/messages" element={<Navigate to="/team/chat" replace />} />
          <Route path="/signup" element={<Navigate to="/login" replace />} />
          <Route path="/reset-password" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </>
  )
}
