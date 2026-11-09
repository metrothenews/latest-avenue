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
    getAll(token, `${campaignId}/adsets`, { fields: 'id,name,status,daily_budget,lifetime_budget,end_time,optimization_goal,promoted_object' }),
    getAll(token, `${campaignId}/ads`, { fields: `id,name,status,adset_id,tracking_specs,conversion_domain,creative{${CREATIVE_FIELDS}}` }),
  ])
  return { adsets, ads }
}

// --- Conversion event ---

// Pixel event names that are Meta standard events, and their promoted_object.custom_event_type.
// Any other name the pixel fires is a custom event (custom_event_type OTHER + custom_event_str).
// PageView is left out: Meta doesn't let ad sets optimize for it.
const STANDARD_EVENTS = {
  Purchase: 'PURCHASE',
  Lead: 'LEAD',
  CompleteRegistration: 'COMPLETE_REGISTRATION',
  Contact: 'CONTACT',
  Schedule: 'SCHEDULE',
  SubmitApplication: 'SUBMIT_APPLICATION',
  Subscribe: 'SUBSCRIBE',
  StartTrial: 'START_TRIAL',
  AddToCart: 'ADD_TO_CART',
  InitiateCheckout: 'INITIATED_CHECKOUT',
  AddPaymentInfo: 'ADD_PAYMENT_INFO',
  AddToWishlist: 'ADD_TO_WISHLIST',
  ViewContent: 'CONTENT_VIEW',
  Search: 'SEARCH',
  CustomizeProduct: 'CUSTOMIZE_PRODUCT',
  FindLocation: 'FIND_LOCATION',
  Donate: 'DONATE',
}
const EVENT_DAYS = 30

// The events `pixelId` received in the last 30 days, most fired first, as conversion options.
// From the pixel's event stats (hourly buckets, added up here). The site keeps the result in
// Firestore for 30 days (loadPixelEvents in campaignRuns.js) rather than asking every time.
export async function listPixelEvents(token, pixelId) {
  const since = Math.floor(Date.now() / 1000) - EVENT_DAYS * 86400
  const buckets = await getAll(token, `${pixelId}/stats`, { aggregation: 'event', start_time: since }, 5000)
  const counts = new Map()
  for (const b of buckets) for (const { value, count } of b.data ?? []) counts.set(value, (counts.get(value) ?? 0) + Number(count ?? 0))
  return [...counts]
    .filter(([name]) => name && name !== 'PageView')
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => pixelEventOption(name, count))
}

// A pixel event as a conversion option. `count`: times fired in the last 30 days.
export const pixelEventOption = (name, count) => ({ key: `event:${name}`, name, type: STANDARD_EVENTS[name] ?? 'OTHER', label: name, count })

// The pixel an ad set optimizes for, or null if it doesn't optimize for a website conversion.
export const adsetPixel = (adset) => adset.promotedObject?.pixel_id ?? adset.promoted_object?.pixel_id ?? null

// A readable name for what an ad set's promoted_object counts as a conversion.
export function conversionLabel(promoted, customConversions = []) {
  if (!promoted?.pixel_id) return null
  if (promoted.custom_conversion_id) {
    return customConversions.find((c) => c.id === promoted.custom_conversion_id)?.name ?? `Custom conversion ${promoted.custom_conversion_id}`
  }
  if (promoted.custom_event_str) return promoted.custom_event_str
  const standard = Object.entries(STANDARD_EVENTS).find(([, type]) => type === promoted.custom_event_type)
  return standard?.[0] ?? promoted.custom_event_type ?? null
}

// The ad account's custom conversions on `pixelId` (cached per account, as several runs ask at once).
const conversionCache = new Map()
export function listCustomConversions(token, accountId) {
  if (!conversionCache.has(accountId)) {
    const request = getAll(token, `${accountId}/customconversions`, { fields: 'id,name,custom_event_type,is_archived,pixel{id}' })
      .then((list) => list.filter((c) => !c.is_archived).map((c) => ({ key: `custom:${c.id}`, id: c.id, label: c.name, type: c.custom_event_type, pixelId: c.pixel?.id ?? null })))
    request.catch(() => conversionCache.delete(accountId))
    conversionCache.set(accountId, request)
  }
  return conversionCache.get(accountId)
}

// The copied ad set's promoted_object with its conversion set to `conversion` (a pixel event or
// custom conversion option), keeping the template's pixel.
export function promotedObjectFor(promoted, conversion) {
  const { custom_event_type, custom_event_str, custom_conversion_id, pixel_rule, ...rest } = promoted // eslint-disable-line no-unused-vars
  if (conversion.key.startsWith('custom:')) return { ...rest, custom_event_type: conversion.type ?? 'OTHER', custom_conversion_id: conversion.id }
  if (conversion.type && conversion.type !== 'OTHER') return { ...rest, custom_event_type: conversion.type }
  return { ...rest, custom_event_type: 'OTHER', custom_event_str: conversion.name }
}

export const setAdSetConversion = (token, adsetId, promoted) => graphPost(token, adsetId, { promoted_object: promoted })

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

// Meta's processing state as 'ready', 'processing' or 'error'.
const processing = (status) => {
  const s = status?.video_status
  return s === 'ready' ? 'ready' : s === 'error' || s === 'expired' ? 'error' : 'processing'
}

// One video's state, or 'gone' if it was deleted from the library.
export async function videoStatus(token, videoId) {
  try {
    return processing((await graphGet(token, videoId, { fields: 'status' })).status)
  } catch (err) {
    if (err.kind === 'auth') throw err
    return 'gone'
  }
}

// { [videoId]: state } for many videos, 50 per request. A deleted video fails the whole request,
// so that batch falls back to one request per video.
export async function videoStatuses(token, ids) {
  const out = {}
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)
    try {
      const body = await graphGet(token, '', { ids: batch.join(','), fields: 'status' })
      for (const id of batch) out[id] = body[id] ? processing(body[id].status) : 'gone'
    } catch (err) {
      if (err.kind === 'auth') throw err
      for (const id of batch) out[id] = await videoStatus(token, id)
    }
  }
  return out
}

// The preferred thumbnail of a processed video.
export async function videoThumbnail(token, videoId) {
  const { data = [] } = await graphGet(token, `${videoId}/thumbnails`, { fields: 'uri,is_preferred' })
  const thumb = data.find((t) => t.is_preferred) ?? data[0]
  if (!thumb) throw new MetaError('Meta returned no thumbnail for this video.')
  return thumb.uri
}

// Why a template ad's creative can't be reused with a new video, or null if it can.
export function templateProblem(creative) {
  if (!creative) return "This ad's creative couldn't be read."
  const spec = creative.object_story_spec
  if (spec?.link_data?.child_attachments) return 'Carousel ads can’t be used as a template. Pick a single image or video ad.'
  if (creative.asset_feed_spec || spec?.video_data || spec?.link_data) return null
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

// The template's call-to-action, pointing at the ads' link (Meta rejects video ads without one).
function withLink(cta, template, link) {
  const next = clone(cta ?? { type: template.call_to_action_type ?? 'LEARN_MORE' })
  if (link) next.value = { ...next.value, link }
  return next
}

// A flexible creative's link list pointing at `link`. A display URL belongs to the old link, so it's
// dropped when the link changes.
const relink = (urls, link) =>
  urls.map(({ display_url, ...l }) => ({ ...l, website_url: link, ...(l.website_url === link && display_url && { display_url }) }))

// The template's Advantage+ enhancement choices, minus `standard_enhancements`: Meta still returns it
// on older ads but rejects it on new creatives ("deprecated, set individual features instead"). The
// individual features it bundled are listed separately and are kept.
function enhancementsFromTemplate(spec) {
  if (!spec?.creative_features_spec?.standard_enhancements) return spec
  const next = clone(spec)
  delete next.creative_features_spec.standard_enhancements
  return next
}

// The template creative with only the video (and its thumbnail) swapped, and every destination
// link set to `link` (the template's own link if none is given).
export function creativeFromTemplate(template, { name, videoId, thumbnailUrl, link: chosenLink }) {
  const params = { name, url_tags: template.url_tags, degrees_of_freedom_spec: enhancementsFromTemplate(template.degrees_of_freedom_spec) }
  const spec = clone(template.object_story_spec ?? {})
  const link = chosenLink || templateLink(template)
  const feed = template.asset_feed_spec && clone(template.asset_feed_spec)
  const feedHasMedia = Boolean(feed?.videos?.length || feed?.images?.length)

  if (feed && !feedHasMedia && (spec.video_data || spec.link_data)) {
    // Several text options: the feed only holds alternative texts, while the video and button link
    // live in the story spec. Keep the texts as they are; the media and link are swapped below.
    if (link && feed.link_urls?.length) feed.link_urls = relink(feed.link_urls, link)
    if (feed.ad_formats) feed.ad_formats = ['SINGLE_VIDEO']
    params.asset_feed_spec = feed
  } else if (feed) {
    // Flexible / dynamic creative: the feed holds the media too. Same texts, links and CTAs, one video.
    feed.videos = [{ video_id: videoId, thumbnail_url: thumbnailUrl }]
    delete feed.images
    feed.ad_formats = ['SINGLE_VIDEO']
    if (link) feed.link_urls = relink(feed.link_urls?.length ? feed.link_urls : [{}], link)
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
    spec.video_data.call_to_action = withLink(spec.video_data.call_to_action, template, link)
  } else {
    // Single-image template: carry its text, headline, link and CTA over to a video ad.
    const image = spec.link_data
    spec.video_data = {
      video_id: videoId,
      image_url: thumbnailUrl,
      message: image.message,
      title: image.name,
      link_description: image.description,
      call_to_action: withLink(image.call_to_action, template, link),
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

// --- Results (read-only) ---

export const resultPeriods = [
  { id: 'today', label: 'Today' },
  { id: 'last_7d', label: 'Last 7 days' },
  { id: 'last_30d', label: 'Last 30 days' },
  { id: 'maximum', label: 'Lifetime' },
]

// The insights action types that count as a "result" for an ad set, from what it optimizes for.
// Several candidates, most specific first: Meta reports some events under more than one name.
export function resultActionTypes(adset) {
  const p = adset.promoted_object ?? {}
  if (p.custom_conversion_id) return [`offsite_conversion.custom.${p.custom_conversion_id}`]
  if (p.custom_event_str) return [`offsite_conversion.fb_pixel_custom.${p.custom_event_str}`, 'offsite_conversion.fb_pixel_custom']
  if (p.custom_event_type && p.custom_event_type !== 'OTHER') {
    const event = p.custom_event_type.toLowerCase()
    return [`offsite_conversion.fb_pixel_${event}`, event]
  }
  const byGoal = {
    LINK_CLICKS: ['link_click'],
    LANDING_PAGE_VIEWS: ['landing_page_view'],
    THRUPLAY: ['video_thruplay_watched'],
    POST_ENGAGEMENT: ['post_engagement'],
    PAGE_LIKES: ['like'],
  }
  return byGoal[adset.optimization_goal] ?? []
}

const actionValue = (list, types) => {
  for (const type of types) {
    const hit = list?.find((a) => a.action_type === type)
    if (hit) return Number(hit.value)
  }
  return null
}

const INSIGHT_FIELDS = 'spend,impressions,reach,inline_link_clicks,actions'

// Insights numbers in a common shape. `types` are the result action types (resultActionTypes);
// with none, results are unknown (null) rather than zero.
function metrics(row = {}, types = []) {
  const spend = Number(row.spend ?? 0)
  const results = types.length ? actionValue(row.actions, types) ?? 0 : null
  return {
    spend,
    impressions: Number(row.impressions ?? 0),
    reach: Number(row.reach ?? 0),
    linkClicks: Number(row.inline_link_clicks ?? 0),
    results,
    costPerResult: results ? spend / results : null,
  }
}

// A campaign, its ad sets and every ad, each with its numbers for `period` (one of resultPeriods).
// Ads with no delivery yet show zeros. Totals come from Meta at each level, because reach can't be
// added up (one person can see several ads). Money is in the ad account's currency units.
export async function getCampaignResults(token, campaignId, period) {
  const insights = (level, fields) => getAll(token, `${campaignId}/insights`, { level, date_preset: period, fields }, 5000)
  const [campaign, adsets, ads, adRows, adsetRows, [campaignRow]] = await Promise.all([
    graphGet(token, campaignId, { fields: 'id,name,status,effective_status,account{currency}' }),
    getAll(token, `${campaignId}/adsets`, { fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,optimization_goal,promoted_object' }),
    getAll(token, `${campaignId}/ads`, { fields: 'id,name,adset_id,effective_status' }),
    insights('ad', `ad_id,${INSIGHT_FIELDS}`),
    insights('adset', `adset_id,${INSIGHT_FIELDS}`),
    insights('campaign', INSIGHT_FIELDS),
  ])
  const types = new Map(adsets.map((a) => [a.id, resultActionTypes(a)]))
  const adData = new Map(adRows.map((r) => [r.ad_id, r]))
  const adsetData = new Map(adsetRows.map((r) => [r.adset_id, r]))
  // Campaign results only make sense when every ad set counts the same thing.
  const shared = [...new Set([...types.values()].map((t) => t.join()))].length === 1 ? [...types.values()][0] : []
  return {
    currency: campaign.account?.currency ?? 'USD',
    campaign: { ...campaign, ...metrics(campaignRow, shared) },
    adsets: adsets.map((a) => ({ ...a, ...metrics(adsetData.get(a.id), types.get(a.id)) })),
    ads: ads.map((ad) => ({ id: ad.id, name: ad.name, adsetId: ad.adset_id, status: ad.effective_status, ...metrics(adData.get(ad.id), types.get(ad.adset_id)) })),
  }
}

export const adsManagerUrl = (accountId, campaignId) =>
  `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${accountId.replace(/^act_/, '')}&selected_campaign_ids=${campaignId}`
