// Inline status message (used where the backend isn't wired up yet).
export default function Notice({ children }) {
  if (!children) return null
  return <p role="status" className="mt-4 rounded-lg glass bg-white/5 p-3 text-sm text-white/70">{children}</p>
}
