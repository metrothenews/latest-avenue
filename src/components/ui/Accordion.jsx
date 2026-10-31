import { useState } from 'react'

// items: [{ id, question, answer }]. One item open at a time.
export default function Accordion({ items }) {
  const [openId, setOpenId] = useState(null)
  return (
    <div className="divide-y divide-white/10 rounded-xl glass">
      {items.map((item) => {
        const open = openId === item.id
        return (
          <div key={item.id}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : item.id)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium hover:bg-white/5"
            >
              <span>{item.question}</span>
              <span className="text-white/50">{open ? '−' : '+'}</span>
            </button>
            {open && <div className="px-5 pb-5 text-white/60">{item.answer}</div>}
          </div>
        )
      })}
    </div>
  )
}
