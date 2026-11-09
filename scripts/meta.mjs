#!/usr/bin/env node
// Command-line access to the Meta Marketing API for testing the campaign builder, using the same
// code as the site (src/lib/meta.js). Run `npm run meta -- help` for commands.
//
// Safety: it can read anything the token can, but the only write it allows is creating an ad
// creative, and by default even that is validate-only (Meta checks it, nothing is created).
// Ads are only ever validated, never created. It never creates campaigns, ad sets or ads and never
// changes a status, so it can't spend money.
//
// The Meta token is kept in .secrets/meta-token (git-ignored, readable only by you). Saved runs are
// read from Firestore with the gcloud login of the project owner (metrothenews@gmail.com).
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { creativeFromTemplate, getCampaignResults, getMe, graphGet, graphPost, listAdAccounts, videoStatus, videoThumbnail } from '../src/lib/meta.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TOKEN_FILE = join(ROOT, '.secrets', 'meta-token')
const PROJECT = 'latest-avenue-app'
const OWNER = 'metrothenews@gmail.com'

const out = (value) => console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function token() {
  if (!existsSync(TOKEN_FILE)) fail('No Meta token saved. Run `npm run meta -- login` in your own terminal first.')
  return readFileSync(TOKEN_FILE, 'utf8').trim()
}

// Reads a line without echoing it, so the token doesn't show on screen or in scrollback.
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s) }
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer.trim())
    })
  })
}

// --- Firestore (saved runs), read-only ---

function firestore(path) {
  const access = execFileSync('gcloud', ['auth', 'print-access-token', '--account', OWNER], { encoding: 'utf8' }).trim()
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${path}`
  return fetch(url, { headers: { Authorization: `Bearer ${access}`, 'x-goog-user-project': PROJECT } }).then((r) => r.json())
}

function fromFirestore(v) {
  const [kind, x] = Object.entries(v)[0]
  if (kind === 'mapValue') return Object.fromEntries(Object.entries(x.fields ?? {}).map(([k, f]) => [k, fromFirestore(f)]))
  if (kind === 'arrayValue') return (x.values ?? []).map(fromFirestore)
  if (kind === 'integerValue') return Number(x)
  if (kind === 'nullValue') return null
  return x
}

async function listRuns() {
  const body = await firestore('campaignRuns?pageSize=100')
  if (body.error) fail(body.error.message)
  return (body.documents ?? []).map((d) => fromFirestore({ mapValue: d })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

async function findRun(id) {
  const runs = await listRuns()
  const run = id ? runs.find((r) => r.id === id || r.id.startsWith(id)) : runs[0]
  if (!run) fail(id ? `No saved run matching "${id}". Try \`npm run meta -- runs\`.` : 'No saved runs.')
  return run
}

// --- creative experiments ---

// Removes a dotted path such as degrees_of_freedom_spec.creative_features_spec.advantage_plus_creative.
function dropPath(obj, path) {
  const keys = path.split('.')
  const last = keys.pop()
  const parent = keys.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
  if (!parent || !(last in parent)) return false
  delete parent[last]
  return true
}

async function buildCreative(run, flags) {
  const templateAd = JSON.parse(run.templateAdJson)
  const index = flags.video ? Number(flags.video) - 1 : run.videos.findIndex((v) => v.videoId)
  const video = run.videos[index]
  if (!video?.videoId) fail('That video has no Meta video yet. Upload it from the site first.')
  const state = await videoStatus(token(), video.videoId)
  if (state !== 'ready') fail(`Meta video ${video.videoId} (${video.name}) is ${state}, not ready.`)
  const thumbnailUrl = await videoThumbnail(token(), video.videoId)
  const params = creativeFromTemplate(templateAd.creative, { name: video.name.replace(/\.[^.]+$/, ''), videoId: video.videoId, thumbnailUrl, link: run.link })
  for (const path of [flags.drop ?? []].flat()) {
    if (!dropPath(params, path)) console.error(`(nothing at ${path} to drop)`)
  }
  return { params, video }
}

// The CLI's only write. Validate-only unless --create is passed.
async function postCreative(run, params, create) {
  const body = create ? params : { ...params, execution_options: ['validate_only'] }
  return graphPost(token(), `${run.accountId}/adcreatives`, body)
}

// Validate-only, always: a paused ad with this creative inline, in one of the template's ad sets.
async function validateAd(run, params, adsetIndex) {
  const templateAd = JSON.parse(run.templateAdJson)
  const adset = run.adsets[adsetIndex] ?? fail(`The run has ${run.adsets.length} ad set(s).`)
  return { adset, result: await graphPost(token(), `${run.accountId}/ads`, {
    name: params.name,
    adset_id: adset.id,
    creative: params,
    status: 'PAUSED',
    tracking_specs: templateAd.tracking_specs,
    conversion_domain: templateAd.conversion_domain,
    execution_options: ['validate_only'],
  }) }
}

// --- commands ---

const commands = {
  async login() {
    if (!process.stdin.isTTY) fail('Run this in your own terminal so the token can be typed privately.')
    console.log('Paste a Meta access token. On latestavenue.com/admin/campaigns, connect Meta and click')
    console.log('"Copy token for the command-line tool". It lasts 1–2 hours; run this again when it expires.')
    const value = await askHidden('Token (hidden): ')
    if (!value) fail('No token entered.')
    const me = await getMe(value).catch((err) => fail(`Meta rejected that token: ${err.message}`))
    mkdirSync(dirname(TOKEN_FILE), { recursive: true, mode: 0o700 })
    writeFileSync(TOKEN_FILE, value, { mode: 0o600 })
    chmodSync(TOKEN_FILE, 0o600)
    out(`Saved. Connected as ${me.name}.`)
  },

  async whoami() {
    out(await getMe(token()))
  },

  async accounts() {
    out((await listAdAccounts(token())).map((a) => `${a.id}  ${a.name} (${a.currency})`).join('\n'))
  },

  async runs() {
    out((await listRuns()).map((r) => {
      const uploaded = r.videos.filter((v) => v.videoId).length
      return `${r.id}  ${r.name}\n    ${uploaded}/${r.videos.length} uploaded · link ${r.link ?? '(none)'} · campaign ${r.campaignId ?? '(not copied)'} · updated ${r.updatedAt}`
    }).join('\n'))
  },

  async template(args) {
    out(JSON.parse((await findRun(args[0])).templateAdJson).creative)
  },

  // Prints the creative the site would send, after any --drop.
  async params(args, flags) {
    out((await buildCreative(await findRun(args[0]), flags)).params)
  },

  // Asks Meta to validate (or with --create, create) the creative the site would send.
  async creative(args, flags) {
    const run = await findRun(args[0])
    const { params, video } = await buildCreative(run, flags)
    console.error(`${flags.create ? 'Creating' : 'Validating'} creative for ${video.name} (video ${video.videoId}) on ${run.accountId}…`)
    try {
      out(await postCreative(run, params, flags.create))
    } catch (err) {
      fail(`${err.message}${err.code ? ` (code ${err.code})` : ''}`)
    }
  },

  // Asks Meta to validate a paused ad with that creative in the template's ad set. Never creates it.
  async ad(args, flags) {
    const run = await findRun(args[0])
    const { params, video } = await buildCreative(run, flags)
    try {
      const { adset, result } = await validateAd(run, params, flags.adset ? Number(flags.adset) - 1 : 0)
      console.error(`Validated a paused ad for ${video.name} in ad set "${adset.name}" (nothing created).`)
      out(result)
    } catch (err) {
      fail(`${err.message}${err.code ? ` (code ${err.code})` : ''}`)
    }
  },

  // A campaign's results as the site shows them, e.g. `results 1202… --period last_7d`.
  async results(args, flags) {
    const id = args[0] ?? (await findRun()).campaignId
    if (!id) fail('Give a campaign ID, or create the latest run\'s campaign first.')
    try {
      out(await getCampaignResults(token(), id, flags.period ?? 'maximum'))
    } catch (err) {
      fail(`${err.message}${err.code ? ` (code ${err.code})` : ''}`)
    }
  },

  // Read-only Graph API request, e.g. `get 1417644867248222 fields=id,name,degrees_of_freedom_spec`.
  async get(args) {
    const [path, ...rest] = args
    if (!path) fail('Usage: get <path> [key=value …]')
    try {
      out(await graphGet(token(), path, Object.fromEntries(rest.map((p) => p.split(/=(.*)/s).slice(0, 2)))))
    } catch (err) {
      fail(`${err.message}${err.code ? ` (code ${err.code})` : ''}`)
    }
  },

  help() {
    out(`Usage: npm run meta -- <command> [args] [--flags]

  login                       save a Meta token (run in your own terminal; input is hidden)
  whoami                      the Facebook account the token belongs to
  accounts                    ad accounts the token can use
  runs                        saved campaign-builder runs (from Firestore)
  template [runId]            a run's template ad creative (default: latest run)
  params [runId]              the creative the site would send for a run's first ready video
  creative [runId]            ask Meta to validate that creative; nothing is created
  ad [runId] [--adset N]      ask Meta to validate a paused ad with it in the template's Nth ad set; never created
  results [campaignId]        a campaign's results as the site shows them (--period today|last_7d|last_30d|maximum)
  get <path> [k=v …]          any read-only Graph API request

Flags for params / creative:
  --video N                   use the run's Nth video instead of the first uploaded one
  --drop a.b.c                remove a field before sending (repeatable), to test what Meta rejects
  --create                    actually create the creative (not an ad; nothing runs or spends)

Nothing here creates campaigns, ad sets or ads, or changes any status.`)
  },
}

function parse(argv) {
  const args = []
  const flags = {}
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) args.push(a)
    else if (a === '--create') flags.create = true
    else {
      const key = a.slice(2)
      const value = argv[++i]
      flags[key] = key in flags ? [flags[key], value].flat() : value
    }
  }
  return { args, flags }
}

const [name = 'help', ...rest] = process.argv.slice(2)
const command = commands[name]
if (!command) fail(`Unknown command "${name}". Run \`npm run meta -- help\`.`)
const { args, flags } = parse(rest)
await command(args, flags)
