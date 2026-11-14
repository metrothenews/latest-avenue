import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { seo } from './src/data/seo.js'

// Link previews are read by crawlers that don't run JavaScript, so they only ever see the title
// and description written in index.html. For each page in data/seo.js marked `preview: true`,
// this writes a copy of the built index.html with that page's own title and description to
// dist/<path>.html, which Firebase Hosting serves at <path> (cleanUrls in firebase.json).
function linkPreviews() {
  const attr = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  return {
    name: 'link-previews',
    apply: 'build',
    closeBundle() {
      const html = readFileSync('dist/index.html', 'utf8')
      for (const [path, page] of Object.entries(seo)) {
        if (!page.preview) continue
        const out = html
          .replace(/<title>[^<]*<\/title>/, `<title>${attr(page.title)}</title>`)
          .replace(/(<meta (?:name="description"|property="og:description") content=")[^"]*"/g, `$1${attr(page.description)}"`)
          .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${attr(page.title)}"`)
        const file = `dist${path}.html`
        mkdirSync(file.slice(0, file.lastIndexOf('/')), { recursive: true })
        writeFileSync(file, out)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), linkPreviews()],
})
