import Button from '../../components/ui/Button.jsx'
import { note } from '../../data/note.js'

// /team/note: the front door of latest avenue note. A simple placeholder for now; the full
// public homepage comes once the boards themselves are built.
export default function NoteHome() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">{note.name}</h1>
      <p className="mt-4 max-w-xl text-white/70">{note.tagline}</p>
      <Button to="/team/note/home" className="mt-8">{note.open}</Button>
    </div>
  )
}
