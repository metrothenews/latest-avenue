import { downloadFile } from './drive.js'
import {
  copyAdSet, copyCampaign, createAd, createCreative, creativeFromTemplate, uploadVideo, waitForVideo,
} from './meta.js'

// Builds a new paused campaign from a template campaign: same campaign and ad set settings,
// one ad per Drive video in every ad set, each ad identical to `templateAd` except the video.
//
// Order is chosen so a failure leaves as little behind as possible: each video is uploaded and
// turned into a creative first. If the very first creative is rejected, the template itself is the
// problem, so the run stops right there, before uploading more videos or copying anything.
// Only once creatives exist are the campaign and ad sets copied and the ads created.
//
// log(entry) receives { id, text, state: 'running' | 'done' | 'error', detail?, progress? }.
// Returns { campaignId, adIds, failures }.
export async function runCampaignCopy({ metaToken, driveToken, accountId, campaign, adsets, templateAd, videos, name }, log, isCancelled) {
  const failures = []
  const step = async (id, text, fn) => {
    if (isCancelled()) throw new Error('Stopped before finishing.')
    log({ id, text, state: 'running' })
    try {
      const result = await fn((progress) => log({ id, text, state: 'running', progress }))
      log({ id, text, state: 'done' })
      return result
    } catch (err) {
      log({ id, text, state: 'error', detail: err.message })
      throw err
    }
  }

  // 1. Per video: Drive → browser → Meta, wait for processing, then make its creative.
  const baseName = (n) => n.replace(/\.[^.]+$/, '')
  const ready = []
  for (const v of videos) {
    let videoId
    let thumbnailUrl
    try {
      const blob = await step(`dl-${v.id}`, `Download ${v.name} from Drive`, () => downloadFile(driveToken, v.id))
      videoId = await step(`up-${v.id}`, `Upload ${v.name} to Meta`, (progress) => uploadVideo(metaToken, accountId, blob, v.name, progress))
      thumbnailUrl = await step(`proc-${v.id}`, `Wait for Meta to process ${v.name}`, () => waitForVideo(metaToken, videoId, { isCancelled }))
    } catch (err) {
      if (isCancelled() || err.kind === 'auth') throw err
      failures.push({ name: v.name, error: err.message })
      continue
    }
    try {
      const creativeId = await step(`cr-${v.id}`, `Create creative for ${v.name}`, () =>
        createCreative(metaToken, accountId, creativeFromTemplate(templateAd.creative, { name: baseName(v.name), videoId, thumbnailUrl })))
      ready.push({ ...v, creativeId })
    } catch (err) {
      if (isCancelled() || err.kind === 'auth') throw err
      // The first creative failing means the template can't be reused: stop before doing more work.
      if (!ready.length) throw new Error(`Meta rejected the ad built from the template ad, so the run stopped before copying anything: ${err.message}`)
      failures.push({ name: v.name, error: err.message })
    }
  }
  if (!ready.length) throw new Error('No videos could be uploaded, so nothing was created.')

  // 2. Campaign and ad sets, copied with identical settings (paused).
  const campaignId = await step('campaign', `Copy campaign “${campaign.name}” as “${name}”`, () => copyCampaign(metaToken, campaign.id, name))
  const newAdsets = []
  for (const a of adsets) {
    try {
      const id = await step(`adset-${a.id}`, `Copy ad set “${a.name}”`, () => copyAdSet(metaToken, a.id, campaignId))
      newAdsets.push({ ...a, newId: id })
    } catch (err) {
      if (isCancelled() || err.kind === 'auth') throw err
      failures.push({ name: `Ad set ${a.name}`, error: err.message })
    }
  }

  // 3. One ad per video per ad set, all sharing that video's creative.
  const adIds = []
  for (const v of ready) {
    for (const a of newAdsets) {
      try {
        const id = await step(`ad-${v.id}-${a.id}`, `Create ad ${baseName(v.name)} in “${a.name}”`, () =>
          createAd(metaToken, accountId, { name: baseName(v.name), adsetId: a.newId, creativeId: v.creativeId, templateAd }))
        adIds.push(id)
      } catch (err) {
        if (isCancelled() || err.kind === 'auth') throw err
        failures.push({ name: `${v.name} in ${a.name}`, error: err.message })
      }
    }
  }

  return { campaignId, adIds, failures }
}
