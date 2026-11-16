import { Link } from 'react-router-dom'
import { useAuth } from '../../components/auth/AuthProvider.jsx'

const tools = [
  { to: '/admin/drive', title: 'Drive', text: 'Search and preview your Google Drive files.' },
  { to: '/admin/campaigns', title: 'New Meta campaign', text: 'Copy a Meta campaign and add one ad per video from a Drive folder.' },
  { to: '/analytics', title: 'Analytics', text: 'Your Meta Ads spend, reach, clicks and costs at a glance, per day and per campaign.' },
  { to: '/admin/team', title: 'Admin', text: 'Choose who can open the team portal and edit its welcome message.' },
  { to: '/admin/experience', title: 'Experience', text: 'Run the 360° experience for a room: players, controls and the story.' },
  { to: '/team', title: 'Team', text: 'The team portal as your team sees it: the welcome page and messages.' },
  { to: '/team/note', title: 'Note', text: 'Visual boards for notes, to-dos, PDFs and ideas, shared with the team.' },
]

// Landing page for owner-only features. Add new tools as routes under /admin in App.jsx and list them here.
export default function Dashboard() {
  const { user } = useAuth()
  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight">Dashboard</h1>
      <p className="mt-3 text-white/60">Signed in as {user.displayName ?? user.email}.</p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <li key={t.to}>
            <Link to={t.to} className="glass block p-6 hover:border-white/30">
              <h2 className="text-lg font-semibold">{t.title}</h2>
              <p className="mt-2 text-sm text-white/60">{t.text}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
