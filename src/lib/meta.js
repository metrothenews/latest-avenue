// Meta Marketing API helpers, called straight from the browser.
// Reference: https://developers.facebook.com/docs/marketing-api/reference
export const GRAPH_VERSION = 'v24.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`
const GRAPH_VIDEO = `https://graph-video.facebook.com/${GRAPH_VERSION}`
const CHUNK_RETRIES = 3

export class MetaError extends Error {
  constructor(message, { code, kind = 'other' } = {}) {
    super(message)
    this.code = code
    this.kind = kind // 'auth' when the token is invalid or expired
  }
}

// Graph API expects nested objects as JSON strings in form-encoded bodies.
function encode(params) {
  const out = {}
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    out[k] = typeof v === 'object' && !(v instanceof Blob) ? JSON.stringify(v) : v
  }
  return out
}

async function parse(res) {
  const body = await res.json().catch(() => ({}))
  if (res.ok && !body.error) return body
  const e = body.error ?? {}
  const message = e.error_user_msg || e.message || `Meta request failed (${res.status}).`
  throw new MetaError(message, { code: e.code, kind: e.code === 190 || (e.type === 'OAuthException' && res.status === 401) ? 'auth' : 'other' })
}

export async function graphGet(token, path, params = {}) {
  const qs = new URLSearchParams({ ...encode(params), access_token: token })
  return parse(await fetch(`${GRAPH}/${path}?${qs}`))
}

export async function graphPost(token, path, params = {}, base = GRAPH) {
  const form = new FormData()
  for (const [k, v] of Object.entries(encode(params))) form.append(k, v)
  form.append('access_token', token)
  return parse(await fetch(`${base}/${path}`, { method: 'POST', body: form }))
}

// Follows `paging.next` until done (capped so a huge account can't hang the page).
async function getAll(token, path, params, max = 1000) {
  const items = []
  let page = await graphGet(token, path, { limit: 200, ...params })
  while (true) {
    items.push(...(page.data ?? []))
    if (!page.paging?.next || items.length >= max) return items
    page = await parse(await fetch(page.paging.next))
  }
}

export const getMe = (token) => graphGet(token, 'me', { fields: 'id,name' })

export const listAdAccounts = (token) =>
  getAll(token, 'me/adaccounts', { fields: 'id,account_id,name,currency,account_status' })

export const listCampaigns = (token, accountId) =>
  getAll(token, `${accountId}/campaigns`, { fields: 'id,name,status,effective_status,objective,created_time' })

const CREATIVE_FIELDS = 'id,name,object_story_spec,asset_feed_spec,url_tags,degrees_of_freedom_spec,effective_object_story_id,thumbnail_url,body,title,link_url,object_url,call_to_action_type,object_type'

// Ad sets and ads (with full creative) of a campaign: the template for a copy.
export async function getCampaignTemplate(token, campaignId) {
  const [adsets, ads] = await Promise.all([
    getAll(token, `${campaignId}/adsets`, { fields: 'id,name,status,daily_budget,lifetime_budget,end_time' }),
    getAll(token, `${campaignId}/ads`, { fields: `id,name,status,adset_id,tracking_specs,conversion_domain,creative{${CREATIVE_FIELDS}}` }),
  ])
  return { adsets, ads }
}

// Duplicates a campaign or ad set without its children ("shallow copy"), paused.
export async function copyCampaign(token, campaignId, name) {
  const { copied_campaign_id: id } = await graphPost(token, `${campaignId}/copies`, { deep_copy: false, status_option: 'PAUSED' })
  if (name) await graphPost(token, id, { name })
  return id
}

export async function copyAdSet(token, adsetId, campaignId) {
  const { copied_adset_id: id } = await graphPost(token, `${adsetId}/copies`, { campaign_id: campaignId, deep_copy: false, status_option: 'PAUSED' })
  return id
}

// Resumable upload of a video Blob to the ad account's video library. Returns the video id.
// onProgress(fraction) is called after each chunk.
export async function uploadVideo(token, accountId, blob, title, onProgress = () => {}) {
  const start = await graphPost(token, `${accountId}/advideos`, { upload_phase: 'start', file_size: blob.size }, GRAPH_VIDEO)
  const session = start.upload_session_id
  let from = Number(start.start_offset)
  let to = Number(start.end_offset)
  while (from < to) {
    let result
    for (let attempt = 1; ; attempt += 1) {
      try {
        result = await graphPost(token, `${accountId}/advideos`, {
          upload_phase: 'transfer',
          upload_session_id: session,
          start_offset: from,
          video_file_chunk: blob.slice(from, to),
        }, GRAPH_VIDEO)
        break
      } catch (err) {
        if (attempt >= CHUNK_RETRIES || err.kind === 'auth') throw err
      }
    }
    from = Number(result.start_offset)
    to = Number(result.end_offset)
    onProgress(Math.min(from / blob.size, 1))
  }
  await graphPost(token, `${accountId}/advideos`, { upload_phase: 'finish', upload_session_id: session, title }, GRAPH_VIDEO)
  return start.video_id
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Waits until Meta has processed the video, then returns its preferred thumbnail URL.
export async function waitForVideo(token, videoId, { timeoutMs = 15 * 60 * 1000, isCancelled = () => false } = {}) {
  const deadline = Date.now() + timeoutMs
  while (true) {
    const { status } = await graphGet(token, videoId, { fields: 'status' })
    if (status?.video_status === 'ready') break
    if (status?.video_status === 'error') throw new MetaError('Meta could not process this video.')
    if (Date.now() > deadline) throw new MetaError('Timed out waiting for Meta to process the video.')
    if (isCancelled()) throw new MetaError('Stopped.')
    await sleep(5000)
  }
  const { data = [] } = await graphGet(token, `${videoId}/thumbnails`, { fields: 'uri,is_preferred' })
  const thumb = data.find((t) => t.is_preferred) ?? data[0]
  if (!thumb) throw new MetaError('Meta returned no thumbnail for this video.')
  return thumb.uri
}

// Why a template ad's creative can't be reused with a new video, or null if it can.
export function templateProblem(creative) {
  if (!creative) return "This ad's creative couldn't be read."
  const spec = creative.object_story_spec
  if (creative.asset_feed_spec) return null
  if (spec?.video_data) return null
  if (spec?.link_data?.child_attachments) return 'Carousel ads can’t be used as a template. Pick a single image or video ad.'
  if (spec?.link_data) return null
  return 'This ad promotes an existing post, so its video can’t be swapped. Pick an ad created in Ads Manager.'
}

const clone = (o) => JSON.parse(JSON.stringify(o))

// Where the template's destination link lives varies by how the ad was made: inside the video's
// call-to-action, in the flexible-creative link list, or on the creative itself (link_url / object_url).
export function templateLink(template) {
  const spec = template.object_story_spec ?? {}
  return spec.video_data?.call_to_action?.value?.link
    ?? spec.link_data?.call_to_action?.value?.link
    ?? spec.link_data?.link
    ?? template.asset_feed_spec?.link_urls?.find((l) => l.website_url)?.website_url
    ?? template.link_url
    ?? template.object_url
    ?? null
}

// A call-to-action that always carries the template's link (Meta rejects video ads without one).
function withLink(cta, template) {
  const link = templateLink(template)
  const next = clone(cta ?? { type: template.call_to_action_type ?? 'LEARN_MORE' })
  if (link && !next.value?.link) next.value = { ...next.value, link }
  return next
}

// The template creative with only the video (and its thumbnail) swapped.
export function creativeFromTemplate(template, { name, videoId, thumbnailUrl }) {
  const params = { name, url_tags: template.url_tags, degrees_of_freedom_spec: template.degrees_of_freedom_spec }
  const spec = clone(template.object_story_spec ?? {})

  if (template.asset_feed_spec) {
    // Flexible / dynamic creative: same texts, links and CTAs, one video.
    const feed = clone(template.asset_feed_spec)
    feed.videos = [{ video_id: videoId, thumbnail_url: thumbnailUrl }]
    delete feed.images
    feed.ad_formats = ['SINGLE_VIDEO']
    const link = templateLink(template)
    if (!feed.link_urls?.length && link) feed.link_urls = [{ website_url: link }]
    params.asset_feed_spec = feed
    // Keep the identity (page, Instagram account) but not the media of the template's story spec.
    const { video_data, link_data, photo_data, template_data, ...identity } = spec // eslint-disable-line no-unused-vars
    params.object_story_spec = identity
    return params
  }

  if (spec.video_data) {
    spec.video_data.video_id = videoId
    spec.video_data.image_url = thumbnailUrl
    delete spec.video_data.image_hash
    spec.video_data.call_to_action = withLink(spec.video_data.call_to_action, template)
  } else {
    // Single-image template: carry its text, headline, link and CTA over to a video ad.
    const link = spec.link_data
    spec.video_data = {
      video_id: videoId,
      image_url: thumbnailUrl,
      message: link.message,
      title: link.name,
      link_description: link.description,
      call_to_action: withLink(link.call_to_action, template),
    }
    delete spec.link_data
  }
  params.object_story_spec = spec
  return params
}

export async function createCreative(token, accountId, params) {
  const { id } = await graphPost(token, `${accountId}/adcreatives`, params)
  return id
}

export async function createAd(token, accountId, { name, adsetId, creativeId, templateAd }) {
  const { id } = await graphPost(token, `${accountId}/ads`, {
    name,
    adset_id: adsetId,
    creative: { creative_id: creativeId },
    status: 'PAUSED',
    tracking_specs: templateAd.tracking_specs,
    conversion_domain: templateAd.conversion_domain,
  })
  return id
}

export const adsManagerUrl = (accountId, campaignId) =>
  `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${accountId.replace(/^act_/, '')}&selected_campaign_ids=${campaignId}`
