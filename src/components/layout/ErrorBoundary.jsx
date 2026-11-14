import { Component } from 'react'
import { isStaleChunkError, reloadForUpdate } from '../../lib/freshness.js'

// Catches a crash anywhere in a page, so the visitor sees a message and a Reload button instead of
// a blank screen. If the crash is an out-of-date copy of the site asking for files that are gone,
// it reloads by itself. (A class, because React only offers error boundaries as classes.)
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    if (isStaleChunkError(error)) reloadForUpdate()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-3 text-white/70">This page couldn't be shown. Reloading usually fixes it.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-full border border-white/25 bg-white/20 px-5 py-2.5 text-sm font-semibold hover:bg-white/30">Reload</button>
      </div>
    )
  }
}
