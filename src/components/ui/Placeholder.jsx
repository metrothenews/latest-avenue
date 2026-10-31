// Dashed box marking where real content/functionality will go.
export default function Placeholder({ label, className = 'h-48' }) {
  return (
    <div className={`flex items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-4 text-center text-sm text-white/40 ${className}`}>
      {label}
    </div>
  )
}
