import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import DOMPurify from 'dompurify'
import FileViewer from './FileViewer.jsx'
import { drivePreviewUrl } from '../../lib/assignments.js'

const ALLOWED_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'br', 'hr', 'a', 'img', 'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub']
const ALLOWED_ATTR = ['href', 'src', 'alt', 'start', 'colspan', 'rowspan', 'data-align', 'data-level', 'data-kind', 'data-doc', 'data-media', 'target', 'rel']
const DRIVE_ID = /^[\w-]{20,}$/

// A bare address as a link's text (docs saved before links were labelled) → where it goes.
function shortLabel(href) {
  try {
    const url = new URL(href)
    if (url.hostname === 'docs.google.com') return { document: 'Google Doc', spreadsheets: 'Google Sheet', presentation: 'Google Slides' }[url.pathname.split('/')[1]] ?? 'Google Docs'
    if (url.hostname === 'drive.google.com') return url.pathname.includes('/folders/') ? 'Drive folder' : 'Drive file'
    return url.hostname.replace(/^www\./, '')
  } catch {
    return 'Link'
  }
}

// Shows a doc's saved HTML (lib/assignments.js) in the site's style: see .doc-content in index.css.
// Every link is a button, and anything in Google Drive opens without leaving the site:
// - data-doc: a doc that was pulled in; opens as a page at /team/assignments/<id>;
// - any other Drive link: opens in FileViewer over the page (data-view holds Google's preview
//   address; data-media, if set, is an image or audio file that was copied onto the site);
// - links to other websites open in a new tab.
// The HTML is sanitized again here, so nothing but plain formatting can ever reach the page.
export default function DocContent({ html }) {
  const navigate = useNavigate()
  const [viewing, setViewing] = useState(null)

  const safe = useMemo(() => {
    const purify = DOMPurify()
    purify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName !== 'A') return
      const href = node.getAttribute('href') ?? ''
      if (/^(https?:\/\/|www\.)\S+$/i.test(node.textContent.trim())) node.textContent = shortLabel(href)
      const docId = node.getAttribute('data-doc')
      if (docId === 'main' || (docId && DRIVE_ID.test(docId))) {
        node.setAttribute('href', docId === 'main' ? '/team/assignments' : `/team/assignments/${docId}`)
        node.removeAttribute('target')
        node.removeAttribute('data-media')
        return
      }
      node.removeAttribute('data-doc')
      if (!DRIVE_ID.test(node.getAttribute('data-media') ?? '')) node.removeAttribute('data-media')
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noreferrer')
      const preview = drivePreviewUrl(href)
      if (preview) node.setAttribute('data-view', preview)
      if (!node.getAttribute('data-kind')) node.setAttribute('data-kind', preview ? 'Drive' : 'Link')
    })
    // data-view is set above, after sanitizing, so stored HTML can't supply its own.
    return purify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
  }, [html])

  // In-site docs change page, and Drive files open in the viewer, unless the link was opened in a
  // new tab on purpose.
  function onClick(e) {
    const link = e.target.closest?.('a[data-doc], a[data-view]')
    if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    if (link.hasAttribute('data-doc')) return navigate(link.getAttribute('href'))
    setViewing({ title: link.textContent, href: link.href, preview: link.getAttribute('data-view'), mediaId: link.getAttribute('data-media') })
  }

  return (
    <>
      <div className="doc-content" onClick={onClick} dangerouslySetInnerHTML={{ __html: safe }} />
      {/* On <body>, not in here: the frosted card around a doc would trap a full-screen window inside it. */}
      {createPortal(<FileViewer file={viewing} onClose={() => setViewing(null)} />, document.body)}
    </>
  )
}
