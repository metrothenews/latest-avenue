// Standard page section: consistent padding, max width and optional heading.
export default function Section({ id, title, subtitle, className = '', children }) {
  return (
    <section id={id} className={`px-4 py-16 md:py-24 ${className}`}>
      <div className="mx-auto max-w-6xl">
        {title && <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>}
        {subtitle && <p className="mt-3 max-w-2xl text-white/60">{subtitle}</p>}
        <div className={title || subtitle ? 'mt-10' : ''}>{children}</div>
      </div>
    </section>
  )
}
