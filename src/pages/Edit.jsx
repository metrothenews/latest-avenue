import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/layout/Logo.jsx'
import Button from '../components/ui/Button.jsx'
import { useAuth } from '../components/auth/AuthProvider.jsx'
import { edit as copy, editSettings } from '../data/edit.js'
import { editConfigured, getEditStatus, openEditStream, sendEditKey } from '../lib/editStream.js'
import ChatPanel from '../components/edit/ChatPanel.jsx'

// How long to keep asking a service that is still starting before giving up.
const START_TIMEOUT_MS = 120000
const RETRY_MS = 2500

// /edit/sequencer (owner only; it was /edit until the guided flow took that address): the latest avenue video editor, running in the cloud, shown live.
// The page asks the gateway for the editor's state (which starts it if it is off), then opens
// the live view. Mouse, touch and keyboard go to the editor. On a phone, the on-screen keys
// stand in for the keyboard keys the game view uses.
export default function Edit() {
  const { user } = useAuth()
  const page = useRef(null)
  const screen = useRef(null)
  const rfb = useRef(null)
  const run = useRef(0)             // bumps on every connect attempt; stale attempts stop themselves
  const [state, setState] = useState(editConfigured ? 'starting' : 'notDeployed')
  const [full, setFull] = useState(false)
  const [keys, setKeys] = useState(() => window.matchMedia?.('(pointer: coarse)').matches ?? false)
  // The assistant's chat: beside the editor on wide screens, over it on narrow ones.
  // Hidden unless editSettings.assistantChat is on (Sam's plan has no chat; the panel is kept).
  const [chat, setChat] = useState(() => editSettings.assistantChat && (window.matchMedia?.('(min-width: 1024px)').matches ?? false))
  const getToken = useCallback(() => user.getIdToken(), [user])

  const connect = useCallback(async () => {
    if (!editConfigured) return
    const mine = ++run.current
    const stale = () => mine !== run.current
    rfb.current?.disconnect()
    rfb.current = null
    setState('starting')
    const started = Date.now()
    // Wake the service and wait until the editor inside it is up.
    for (;;) {
      try {
        const status = await getEditStatus(await user.getIdToken())
        if (stale()) return
        if (status.editor_ready) break
      } catch (err) {
        if (stale()) return
        if (err.denied) return setState('denied')
      }
      if (Date.now() - started > START_TIMEOUT_MS) return setState('failed')
      await new Promise((r) => setTimeout(r, RETRY_MS))
      if (stale()) return
    }
    setState('connecting')
    try {
      let opened = 0
      // A fresh token for the stream: it stays open until the token runs out (an hour at most).
      const stream = await openEditStream(screen.current, await user.getIdToken(true), {
        connect: () => { if (!stale()) { opened = Date.now(); setState('connected') } },
        disconnect: () => {
          if (stale()) return
          rfb.current = null
          // The gateway ends a stream when its sign-in token expires. If it had been open for
          // a while, that is what happened: carry on with a new token without asking.
          if (opened && Date.now() - opened > 5 * 60 * 1000) connect()
          else setState(opened ? 'disconnected' : 'failed')
        },
        denied: () => { if (!stale()) setState('denied') },
      })
      if (stale()) return stream.disconnect()
      rfb.current = stream
    } catch {
      if (!stale()) setState('failed')
    }
  }, [user])

  useEffect(() => {
    connect()
    return () => {
      run.current++
      rfb.current?.disconnect()
      rfb.current = null
    }
  }, [connect])

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === page.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else page.current?.requestFullscreen?.()
  }

  const press = (k) => {
    sendEditKey(rfb.current, k.key, k.code)
  }

  const connected = state === 'connected'
  const s = copy.status
  const message = {
    notDeployed: [s.notDeployed, s.notDeployedHelp],
    starting: [s.starting, s.startingHelp],
    connecting: [s.connecting, ''],
    disconnected: [s.disconnected, s.disconnectedHelp],
    denied: [s.denied, ''],
    failed: [s.failed, ''],
  }[state]
  const canRetry = state === 'disconnected' || state === 'failed'

  return (
    <div ref={page} className="flex h-dvh flex-col bg-ink">
      <header className="glass-bar shrink-0 border-b">
        <div className="flex h-14 items-center gap-3 px-4">
          <Logo />
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-white/60">{copy.tag}</span>
          <span className="flex min-w-0 items-center gap-2 text-xs text-white/60" role="status">
            <span className={`h-2 w-2 shrink-0 rounded-full ${connected ? 'bg-white' : 'bg-white/30'}`} />
            <span className="hidden truncate sm:inline">{connected ? s.connected : (message?.[0] ?? '')}</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            {editSettings.assistantChat && <Button variant={chat ? 'primary' : 'secondary'} className="min-h-11 !px-4 !py-1.5 sm:min-h-0 sm:!px-3" aria-pressed={chat} onClick={() => setChat((v) => !v)}>{copy.chat.button}</Button>}
            <Button variant={keys ? 'primary' : 'secondary'} className="min-h-11 !px-4 !py-1.5 sm:min-h-0 sm:!px-3" aria-pressed={keys} onClick={() => setKeys((v) => !v)}>{copy.keys}</Button>
            <Button variant="secondary" className="hidden !px-3 !py-1.5 sm:inline-flex" onClick={toggleFull}>{full ? copy.exitFullScreen : copy.fullScreen}</Button>
            <Link to="/edit" className="inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-sm text-white/60 hover:text-white sm:min-h-0">{copy.back}</Link>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
      <main className="relative min-h-0 min-w-0 flex-1">
        {/* The live view draws itself into this element. */}
        <div ref={screen} className={`absolute inset-0 ${connected ? '' : 'invisible'}`} />
        {!connected && message && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="glass max-w-md p-8 text-center">
              <h1 className="text-2xl font-bold tracking-tight">{message[0]}</h1>
              {message[1] && <p className="mt-2 text-sm leading-relaxed text-white/60">{message[1]}</p>}
              {canRetry && <div className="mt-6"><Button onClick={connect}>{copy.reconnect}</Button></div>}
            </div>
          </div>
        )}
      </main>
      {editSettings.assistantChat && chat && editConfigured && (
        <aside className="absolute inset-0 z-10 bg-ink lg:static lg:z-auto lg:w-[22rem] lg:shrink-0 lg:border-l lg:border-white/10 lg:bg-transparent">
          <ChatPanel getToken={getToken} active={connected} />
        </aside>
      )}
      </div>

      {keys && (
        <div className="glass-bar shrink-0 border-t px-2 py-2">
          <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-1.5">
            {copy.pad.map((k) => (
              <button
                key={k.code}
                type="button"
                disabled={!connected}
                onClick={() => press(k)}
                className={`glass min-h-11 rounded-xl px-2 text-sm font-semibold text-white disabled:opacity-40 ${k.wide ? 'min-w-[4.5rem]' : 'min-w-11'} ${k.primary ? 'border-white/30 bg-white/20' : ''}`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
