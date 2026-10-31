import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Scrolls to #anchors on navigation (e.g. /#pricing), otherwise to the top.
export default function ScrollToHash() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      // Don't return scrollIntoView(): newer browsers return a Promise, which React rejects as an effect cleanup.
      if (el) {
        el.scrollIntoView()
        return
      }
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}
