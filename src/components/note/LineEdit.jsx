import { useEffect, useRef, useState } from 'react'

// One-line text field for a card being edited (headings, board and column names, line labels).
// Puts its value in valueRef for the board to save when editing ends.
export default function LineEdit({ value, field, valueRef, placeholder, className = '' }) {
  const [text, setText] = useState(value ?? '')
  const input = useRef(null)
  useEffect(() => {
    input.current.focus()
    input.current.select()
  }, [])
  useEffect(() => {
    valueRef.current = () => ({ [field]: text.trim() })
    return () => { valueRef.current = null }
  }, [text, field, valueRef])
  return <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className={`w-full bg-transparent outline-none placeholder:text-white/50 ${className}`} />
}
