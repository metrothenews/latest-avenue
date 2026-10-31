import { Outlet } from 'react-router-dom'
import Logo from './Logo.jsx'

// Minimal layout: logo on top, content centered (used by reset password).
export default function CenteredLayout() {
  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <Logo />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        <Outlet />
      </div>
    </div>
  )
}
