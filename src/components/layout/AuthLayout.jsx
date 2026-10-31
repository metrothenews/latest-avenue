import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Logo from './Logo.jsx'
import { artists } from '../../data/roster.js'

// Split screen: form on the left, artist quotes on the right (desktop only).
export default function AuthLayout() {
  const [index, setIndex] = useState(0)
  const slide = artists[index]
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="flex flex-col px-6 py-8">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <Outlet />
        </div>
      </div>

      <aside className="hidden flex-col justify-center gap-8 border-l border-white/10 bg-white/[0.03] p-12 backdrop-blur-xl md:flex">
        <div className="glass p-8">
          <p className="text-2xl font-bold">{slide.name}</p>
          <blockquote className="mt-4 text-white/80">“{slide.quote}”</blockquote>
        </div>
        <div className="flex gap-2">
          {artists.map((a, i) => (
            <button
              key={a.id}
              type="button"
              aria-label={`Show slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`h-2.5 w-2.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/30 hover:bg-white/60'}`}
            />
          ))}
        </div>
      </aside>
    </div>
  )
}
