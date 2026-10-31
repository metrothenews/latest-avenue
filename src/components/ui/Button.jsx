import { Link } from 'react-router-dom'

const styles = {
  primary: 'border border-white/25 bg-white/20 text-white backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:bg-white/30',
  secondary: 'border border-white/15 bg-white/5 text-white backdrop-blur-md hover:bg-white/10',
  ghost: 'text-white/80 hover:text-white',
}

// Renders a <Link> when `to` is set, an <a> when `href` is set, otherwise a <button>.
export default function Button({ to, href, variant = 'primary', className = '', children, ...props }) {
  const cls = `inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`
  if (to) return <Link to={to} className={cls} {...props}>{children}</Link>
  if (href) return <a href={href} className={cls} {...props}>{children}</a>
  return <button type="button" className={cls} {...props}>{children}</button>
}
