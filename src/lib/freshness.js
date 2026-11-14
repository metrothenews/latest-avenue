// Keeps a browser from getting stuck on an out-of-date copy of the site.
// Each deploy renames the site's script files. A tab (often on a phone) that was opened before a
// deploy still asks for the old names when it needs another page, and that fails: the page would
// go blank. When that happens the fix is simply to load the site again, which this does, once.
const KEY = 'reloaded-for-update'

// True if this is a "file from an old version is gone" kind of failure.
export const isStaleChunkError = (error) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload|is not a valid JavaScript MIME type|Failed to load module script/i.test(String(error?.message ?? error))

// Reloads the page to pick up the current version. Returns false if it already tried within the
// last minute (so a real outage can't cause a reload loop).
export function reloadForUpdate() {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    return false // no storage: can't guard against a loop, so don't reload automatically
  }
  window.location.reload()
  return true
}

// Vite fires this when a page's script fails to load.
export function watchForStaleChunks() {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForUpdate()) event.preventDefault()
  })
}
