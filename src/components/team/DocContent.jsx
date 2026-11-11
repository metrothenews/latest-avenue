import { useMemo } from 'react'
import DOMPurify from 'dompurify'

const ALLOWED_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'br', 'hr', 'a', 'img', 'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub']
const ALLOWED_ATTR = ['href', 'src', 'alt', 'start', 'colspan', 'rowspan', 'data-align', 'data-level', 'target', 'rel']

// Shows a doc's saved HTML (lib/assignments.js) in the site's style: see .doc-content in index.css.
// The HTML is sanitized again here, so nothing but plain formatting can ever reach the page.
export default function DocContent({ html }) {
  const safe = useMemo(() => {
    const purify = DOMPurify()
    purify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noreferrer')
      }
    })
    return purify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
  }, [html])
  return <div className="doc-content" dangerouslySetInnerHTML={{ __html: safe }} />
}
