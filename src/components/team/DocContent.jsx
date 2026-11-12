import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DOMPurify from 'dompurify'

const ALLOWED_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'br', 'hr', 'a', 'img', 'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub']
const ALLOWED_ATTR = ['href', 'src', 'alt', 'start', 'colspan', 'rowspan', 'data-align', 'data-level', 'data-kind', 'data-doc', 'target', 'rel']
const DOC_ID = /^[\w-]{20,}$/

// A bare address as a link's text (docs saved before links were labelled) → where it goes.
function shortLabel(href) {
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return 'Link'
  }
}

// Shows a doc's saved HTML (lib/assignments.js) in the site's style: see .doc-content in index.css.
// Every link is a button. One with data-doc is a doc that was pulled into the site and opens at
// /team/assignments/<id>; the rest open in a new tab.
// The HTML is sanitized again here, so nothing but plain formatting can ever reach the page.
export default function DocContent({ html }) {
  const navigate = useNavigate()
  const safe = useMemo(() => {
    const purify = DOMPurify()
    purify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName !== 'A') return
      const docId = node.getAttribute('data-doc')
      if (docId === 'main' || (docId && DOC_ID.test(docId))) {
        node.setAttribute('href', docId === 'main' ? '/team/assignments' : `/team/assignments/${docId}`)
        node.removeAttribute('target')
        return
      }
      node.removeAttribute('data-doc')
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noreferrer')
      if (!node.getAttribute('data-kind')) node.setAttribute('data-kind', 'Link')
      if (/^(https?:\/\/|www\.)\S+$/i.test(node.textContent.trim())) node.textContent = shortLabel(node.getAttribute('href') ?? '')
    })
    return purify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
  }, [html])

  // In-site docs change page without a full reload (unless opened in a new tab on purpose).
  function onClick(e) {
    const link = e.target.closest?.('a[data-doc]')
    if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(link.getAttribute('href'))
  }

  return <div className="doc-content" onClick={onClick} dangerouslySetInnerHTML={{ __html: safe }} />
}
