import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Images embedded in the doc arrive as data: URLs; everything else goes through react-markdown's
// safe default (no javascript: links). Raw HTML in the Markdown is never rendered.
const urlTransform = (url) => (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(url) ? url : defaultUrlTransform(url))

const components = {
  h1: (p) => <h2 className="mt-8 text-2xl font-bold tracking-tight first:mt-0" {...p} />,
  h2: (p) => <h3 className="mt-8 text-xl font-semibold first:mt-0" {...p} />,
  h3: (p) => <h4 className="mt-6 text-lg font-semibold first:mt-0" {...p} />,
  h4: (p) => <h5 className="mt-6 font-semibold first:mt-0" {...p} />,
  h5: (p) => <h6 className="mt-4 font-semibold first:mt-0" {...p} />,
  h6: (p) => <h6 className="mt-4 font-semibold text-white/80 first:mt-0" {...p} />,
  p: (p) => <p className="mt-4 leading-relaxed text-white/80 first:mt-0" {...p} />,
  a: ({ href, ...p }) => <a href={href} target="_blank" rel="noreferrer" className="text-white underline decoration-white/40 hover:decoration-white" {...p} />,
  ul: (p) => <ul className="mt-4 list-disc space-y-1.5 pl-6 text-white/80 first:mt-0" {...p} />,
  ol: (p) => <ol className="mt-4 list-decimal space-y-1.5 pl-6 text-white/80 first:mt-0" {...p} />,
  li: (p) => <li className="pl-1 leading-relaxed [&>ol]:mt-1.5 [&>p]:mt-1.5 [&>ul]:mt-1.5" {...p} />,
  blockquote: (p) => <blockquote className="mt-4 border-l-2 border-white/20 pl-4 text-white/70" {...p} />,
  hr: () => <hr className="my-8 border-white/10" />,
  img: ({ src, alt }) => <img src={src} alt={alt ?? ''} className="mt-4 max-w-full rounded-lg" loading="lazy" />,
  code: ({ className, children, ...p }) => <code className={`rounded bg-white/10 px-1.5 py-0.5 text-[0.9em] ${className ?? ''}`} {...p}>{children}</code>,
  pre: (p) => <pre className="mt-4 overflow-x-auto rounded-lg bg-black/40 p-4 text-sm [&>code]:bg-transparent [&>code]:p-0" {...p} />,
  table: (p) => <div className="mt-4 overflow-x-auto first:mt-0"><table className="w-full border-collapse text-left text-sm" {...p} /></div>,
  th: (p) => <th className="border border-white/15 bg-white/5 px-3 py-2 font-semibold" {...p} />,
  td: (p) => <td className="border border-white/15 px-3 py-2 align-top text-white/80" {...p} />,
  input: (p) => <input {...p} disabled className="mr-2 align-middle" />,
}

// Renders an assignment's Markdown in the site's style.
export default function Markdown({ children }) {
  return (
    <div className="break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={urlTransform}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
