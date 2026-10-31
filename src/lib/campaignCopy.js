import { downloadFile } from './drive.js'
import {
  copyAdSet, copyCampaign, createAd, createCreative, creativeFromTemplate, isUsableVideo, listAccountVideos,
  uploadVideo, videoStatus, videoStatuses, videoThumbnail,
} from './meta.js'
import { findUpload, forgetUpload, recordUpload } from './campaignRuns.js'

// A run builds a new paused campaign from a template campaign in two stages. Progress is saved
// (save()) after every step, so either stage can stop at any point and resume later, on any device.
//
// 1. uploadVideos: every Drive video → browser → the ad account's library, two at a time. A video
//    already in that library (same file contents, or a unique video with the same title) is reused.
//    Meta processes the videos on its own afterwards, so the device can then be shut down.
// 2. finishRun: as each video finishes processing, make its creative from the template ad, then one
//    ad per copied ad set. The campaign and ad sets are only copied once the first creative works,
//    so a template Meta rejects leaves nothing behind.
//
// run: { id, name, accountId, campaign: { id, name }, adsets: [{ id, name, newId?, error? }],
//        templateAdJson, campaignId?, videos: [{ driveId, name, size, md5, videoId?, reused?, creativeId?,
//        adIds: { [templateAdsetId]: adId }, error? }] }
// log(entry) receives { id, text, state: 'running' | 'done' | 'error', detail?, progress? }.

const UPLOAD_CONCURRENCY = 2
const POLL_MS = 10000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const baseName = (n) => n.replace(/\.[^.]+$/, '')
const keepGoing = (err, isCancelled) => !isCancelled() && err.kind !== 'auth'

function stepper(log, isCancelled) {
  return async (id, text, fn) => {
    if (isCancelled()) throw new Error('Stopped.')
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
}

// Runs fn over items, `size` at a time. The first error (stop, expired login) ends the pool.
async function pool(items, size, fn) {
  let next = 0
  let failed = null
  const worker = async () => {
    while (!failed && next < items.length) {
      const item = items[next++]
      try {
        await fn(item)
      } catch (err) {
        failed ??= err
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
  if (failed) throw failed
}

// Where a run stands, for the page.
export function runProgress(run) {
  const copied = run.adsets.filter((a) => a.newId)
  const adsMade = run.videos.reduce((n, v) => n + Object.keys(v.adIds ?? {}).length, 0)
  const adsTotal = run.videos.length * run.adsets.length
  return {
    toUpload: run.videos.filter((v) => !v.videoId).length,
    uploaded: run.videos.filter((v) => v.videoId).length,
    adsMade,
    adsTotal,
    complete: adsTotal > 0 && copied.length === run.adsets.length && adsMade === adsTotal,
  }
}

// Stage 1.
export async function uploadVideos(run, { metaToken, driveToken, log, isCancelled, save }) {
  const step = stepper(log, isCancelled)
  let library // the ad account's videos, loaded once, only if a title match is needed

  async function existingVideo(v) {
    const known = await findUpload(run.accountId, v)
    if (known) {
      if (!['gone', 'error'].includes(await videoStatus(metaToken, known.videoId))) return known.videoId
      await forgetUpload(run.accountId, v)
    }
    library ??= listAccountVideos(metaToken, run.accountId)
    const matches = (await library).filter((m) => m.title === v.name && isUsableVideo(m))
    return matches.length === 1 ? matches[0].id : null
  }

  await pool(run.videos.filter((v) => !v.videoId), UPLOAD_CONCURRENCY, async (v) => {
    try {
      const existing = await existingVideo(v)
      if (existing) {
        log({ id: `up-${v.driveId}`, text: `${v.name} is already on Meta, reusing it`, state: 'done' })
        v.videoId = existing
        v.reused = true
      } else {
        const blob = await step(`dl-${v.driveId}`, `Download ${v.name} from Drive`, () => downloadFile(driveToken, v.driveId))
        v.videoId = await step(`up-${v.driveId}`, `Upload ${v.name} to Meta`, (progress) => uploadVideo(metaToken, run.accountId, blob, v.name, progress))
        v.reused = false
      }
      v.error = null
      await recordUpload(run.accountId, v)
    } catch (err) {
      if (!keepGoing(err, isCancelled)) throw err
      v.error = err.message
    } finally {
      await save()
    }
  })
}

// Stage 2. Returns when every uploaded video has its ads, or has failed this time round.
export async function finishRun(run, { metaToken, log, isCancelled, save }) {
  const step = stepper(log, isCancelled)
  const templateAd = JSON.parse(run.templateAdJson)
  const gaveUp = new Set() // things that failed in this session; retried on the next one

  async function ensureCampaign() {
    if (!run.campaignId) {
      run.campaignId = await step('campaign', `Copy campaign “${run.campaign.name}” as “${run.name}”`, () => copyCampaign(metaToken, run.campaign.id, run.name))
      await save()
    }
    for (const a of run.adsets.filter((x) => !x.newId && !gaveUp.has(x.id))) {
      try {
        a.newId = await step(`adset-${a.id}`, `Copy ad set “${a.name}”`, () => copyAdSet(metaToken, a.id, run.campaignId))
        a.error = null
      } catch (err) {
        if (!keepGoing(err, isCancelled)) throw err
        a.error = err.message
        gaveUp.add(a.id)
      }
      await save()
    }
  }

  async function createAds(v) {
    v.adIds ??= {}
    for (const a of run.adsets.filter((x) => x.newId && !v.adIds[x.id] && !gaveUp.has(`${v.driveId}-${x.id}`))) {
      try {
        v.adIds[a.id] = await step(`ad-${v.driveId}-${a.id}`, `Create ad ${baseName(v.name)} in “${a.name}”`, () =>
          createAd(metaToken, run.accountId, { name: baseName(v.name), adsetId: a.newId, creativeId: v.creativeId, templateAd }))
        v.error = null
      } catch (err) {
        if (!keepGoing(err, isCancelled)) throw err
        v.error = err.message
        gaveUp.add(`${v.driveId}-${a.id}`)
      }
      await save()
    }
  }

  // Videos whose creative was made in an earlier session may still be missing ads.
  if (run.videos.some((v) => v.creativeId)) {
    await ensureCampaign()
    for (const v of run.videos.filter((x) => x.creativeId)) await createAds(v)
  }

  log({ id: 'poll', text: 'Waiting for Meta to finish processing videos', state: 'running' })
  while (true) {
    const waiting = run.videos.filter((v) => v.videoId && !v.creativeId && !gaveUp.has(v.driveId))
    if (!waiting.length) break
    const statuses = await videoStatuses(metaToken, waiting.map((v) => v.videoId))
    for (const v of waiting) {
      const state = statuses[v.videoId]
      if (state === 'processing') continue
      if (state !== 'ready') {
        // Deleted, or Meta couldn't process it: back to stage 1 for a fresh upload.
        await forgetUpload(run.accountId, v)
        v.videoId = null
        v.error = state === 'gone' ? 'The video was deleted from Meta. Upload it again.' : 'Meta could not process this video. Upload it again.'
        log({ id: `proc-${v.driveId}`, text: `Process ${v.name}`, state: 'error', detail: v.error })
        await save()
        continue
      }
      try {
        const thumbnailUrl = await step(`proc-${v.driveId}`, `${v.name} processed`, () => videoThumbnail(metaToken, v.videoId))
        v.creativeId = await step(`cr-${v.driveId}`, `Create creative for ${v.name}`, () =>
          createCreative(metaToken, run.accountId, creativeFromTemplate(templateAd.creative, { name: baseName(v.name), videoId: v.videoId, thumbnailUrl })))
        v.error = null
      } catch (err) {
        if (!keepGoing(err, isCancelled)) throw err
        // The first creative failing means the template can't be reused: stop before copying anything.
        if (!run.campaignId && !run.videos.some((x) => x.creativeId)) {
          throw new Error(`Meta rejected the ad built from the template ad, so the run stopped before copying anything: ${err.message}`)
        }
        v.error = err.message
        gaveUp.add(v.driveId)
        await save()
        continue
      }
      await save()
      await ensureCampaign()
      await createAds(v)
    }
    if (run.videos.some((v) => v.videoId && !v.creativeId && !gaveUp.has(v.driveId))) {
      if (isCancelled()) throw new Error('Stopped.')
      await sleep(POLL_MS)
    }
  }
  log({ id: 'poll', text: 'Waiting for Meta to finish processing videos', state: 'done' })
}
