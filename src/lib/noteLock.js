import { useCallback, useState } from 'react'

// The note lock: a personal read-only switch. It is remembered in this browser, so it stays on
// (or off) from board to board and visit to visit until the person switches it again.
const KEY = 'note-locked'

function read() {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function useNoteLock() {
  const [locked, setState] = useState(read)
  const setLocked = useCallback((on) => {
    setState(on)
    try { on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY) } catch { /* private window: lasts for this visit only */ }
  }, [])
  return [locked, setLocked]
}
