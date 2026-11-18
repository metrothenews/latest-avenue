// Talks to the cloud editor's gateway (latest-avenue-edit repo, cloud/gateway.py).
// Every call carries the signed-in user's Firebase ID token; the gateway verifies it on the
// server and only answers for the owner.
import { editServiceUrl } from '../data/edit.js'

export const editConfigured = Boolean(editServiceUrl)

const base = () => editServiceUrl.replace(/\/+$/, '')

// Asks the gateway for the editor's state. Also what wakes the service when it is off.
// Returns { ok, editor_ready, project, viewers }, or throws: err.denied is true when the
// account isn't allowed, otherwise the service couldn't be reached (it may still be starting).
export async function getEditStatus(token) {
  let res
  try {
    res = await fetch(`${base()}/api/status`, { headers: { Authorization: `Bearer ${token}` } })
  } catch {
    throw new Error('unreachable')
  }
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error('denied'), { denied: true })
  if (!res.ok) throw new Error(`status ${res.status}`)
  return res.json()
}

// Calls one of the editor's tools (the same ones the MCP bridge exposes), e.g.
// callEditTool(token, 'list_strips'). Returns the tool's result or throws with its message.
export async function callEditTool(token, method, params = {}) {
  const res = await fetch(`${base()}/api/rpc`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, method, params }),
  })
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error('denied'), { denied: true })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message ?? String(data.error))
  return data.result
}

// --- Chat with the editing agent -------------------------------------------------------
// The agent is a language model running on the same machine as the editor; it works the
// editor through its tools while you watch. These calls only pass messages and read events.

async function chatCall(token, path, body) {
  let res
  try {
    res = await fetch(`${base()}/api/chat/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('unreachable')
  }
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error('denied'), { denied: true })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `status ${res.status}`)
  return data
}

// { session, busy, last, turns, llm: { model, adapters, downloaded, running } }
export const getChatState = (token) => chatCall(token, 'state')

// Waits (up to `wait` seconds, on the server) for events after number `after`.
// Returns { events: [...], busy, last, session, llm }. Each event has seq, ts, type and its
// own fields: user_message / assistant_message { text }, tool_call { id, name, arguments },
// tool_result { id, name, ok, text, seconds }, capability_gap { capability }, model_status
// { state, done, total }, thinking { step }, error { text }, feedback, turn_end, session_start.
export const getChatEvents = (token, after, wait = 25) => chatCall(token, `events?after=${after}&wait=${wait}`)

export const sendChatMessage = (token, text) => chatCall(token, 'send', { text })
export const stopChat = (token) => chatCall(token, 'stop', {})
export const newChat = (token) => chatCall(token, 'new', {})
// rating: 'up' or 'down', about the event numbered `seq`. Goes into the training record.
export const sendChatFeedback = (token, seq, rating, note = '') => chatCall(token, 'feedback', { seq, rating, note })

// Opens the live view of the editor inside `target` (an empty element) and returns the
// connection. The token goes in the WebSocket's protocol list, not the address, so it never
// lands in a log. `on` may have connect(), disconnect({ clean }) and denied() callbacks.
// The viewer code is loaded here, on demand, to keep it out of every other page.
export async function openEditStream(target, token, on = {}) {
  const { default: RFB } = await import('@novnc/novnc/lib/rfb.js')
  const url = `${base().replace(/^http/, 'ws')}/stream`
  const rfb = new RFB(target, url, { wsProtocols: ['binary', `auth.${token}`] })
  rfb.scaleViewport = true   // fit the editor's picture to the space, whatever the screen
  rfb.resizeSession = false  // the editor's own size is fixed, which keeps its cost predictable
  rfb.focusOnClick = true
  rfb.background = 'transparent'
  rfb.addEventListener('connect', () => on.connect?.())
  rfb.addEventListener('disconnect', (e) => on.disconnect?.({ clean: Boolean(e.detail?.clean) }))
  rfb.addEventListener('securityfailure', () => on.denied?.())
  return rfb
}

// Presses and releases one key in the editor (for the on-screen keys).
export function sendEditKey(rfb, keysym, code) {
  if (!rfb) return
  rfb.sendKey(keysym, code, true)
  rfb.sendKey(keysym, code, false)
}
