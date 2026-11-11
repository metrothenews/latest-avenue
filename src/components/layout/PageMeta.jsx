import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { seo, notFoundTitle } from '../../data/seo.js'

function setMeta(attr, key, content) {
  document.querySelector(`meta[${attr}="${key}"]`)?.setAttribute('content', content)
}

// Sets the tab title and description meta tags for the current route (data/seo.js).
export default function PageMeta() {
  const { pathname } = useLocation()
  useEffect(() => {
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
    // `/x/*` entries in data/seo.js cover pages with an ID at the end, e.g. /team/assignments/<id>.
    const page = seo[path] ?? seo[path.replace(/\/[^/]+$/, '/*')]
    const { title, description } = page ?? { ...seo.fallback, title: notFoundTitle }
    document.title = title
    setMeta('name', 'description', description)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
  }, [pathname])
  return null
}
