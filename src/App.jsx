import { Routes, Route, Navigate } from 'react-router-dom'
import SiteLayout from './components/layout/SiteLayout.jsx'
import AuthLayout from './components/layout/AuthLayout.jsx'
import CenteredLayout from './components/layout/CenteredLayout.jsx'
import ScrollToHash from './components/layout/ScrollToHash.jsx'
import PageMeta from './components/layout/PageMeta.jsx'
import Home from './pages/Home.jsx'
import Roster from './pages/Roster.jsx'
import Contact from './pages/Contact.jsx'
import Legal from './pages/Legal.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <>
      <ScrollToHash />
      <PageMeta />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/roster" element={<Roster />} />
          <Route path="/case-studies" element={<Navigate to="/roster" replace />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Legal doc="privacy" />} />
          <Route path="/terms" element={<Legal doc="terms" />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        {/* Not linked from the site anymore; kept in case you add an artist portal. */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>
        <Route element={<CenteredLayout />}>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>
      </Routes>
    </>
  )
}
