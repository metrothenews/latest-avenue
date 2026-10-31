// Firestore storage for the Meta campaign builder (owner-only, see firestore.rules):
// - campaignRuns/{id}: one run of the builder, saved after every step so it can be resumed on any device.
// - metaUploads/{accountId}_{md5}: which Meta video holds which Drive file, so no video is uploaded twice.
import { getApp } from 'firebase/app'
import { collection, deleteDoc, doc, getDoc, getDocsFromServer, initializeFirestore, orderBy, query, setDoc } from 'firebase/firestore'

const db = initializeFirestore(getApp(), { ignoreUndefinedProperties: true })
const RUNS = 'campaignRuns'
const UPLOADS = 'metaUploads'

// Firestore retries forever while it can't reach the server (e.g. the database isn't created yet),
// so every call gets a deadline.
function deadline(promise, seconds) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Couldn't reach Firestore. Check your connection, and that the database exists.")), seconds * 1000)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export const newRunId = () => doc(collection(db, RUNS)).id

export async function listRuns() {
  // From the server, not the offline cache: if Firestore is unreachable this fails instead of showing nothing.
  const snap = await deadline(getDocsFromServer(query(collection(db, RUNS), orderBy('updatedAt', 'desc'))), 15)
  return snap.docs.map((d) => d.data())
}

// Saves are queued per run, so concurrent steps can't land out of order. Each save writes a
// snapshot of the run as it is when save is called.
const queues = new Map()
export function saveRun(run) {
  run.updatedAt = new Date().toISOString()
  const data = JSON.parse(JSON.stringify(run))
  const next = (queues.get(run.id) ?? Promise.resolve()).catch(() => {}).then(() => deadline(setDoc(doc(db, RUNS, run.id), data), 30))
  queues.set(run.id, next)
  return next
}

export const deleteRun = (id) => deadline(deleteDoc(doc(db, RUNS, id)), 30)

// Keyed by the file's contents (Drive's MD5), so a renamed or moved copy still matches.
const uploadKey = (accountId, video) => `${accountId}_${video.md5 ?? `drive-${video.driveId}`}`

export async function findUpload(accountId, video) {
  const snap = await deadline(getDoc(doc(db, UPLOADS, uploadKey(accountId, video))), 30)
  return snap.exists() ? snap.data() : null
}

export const recordUpload = (accountId, video) =>
  deadline(setDoc(doc(db, UPLOADS, uploadKey(accountId, video)), {
    accountId,
    videoId: video.videoId,
    driveId: video.driveId,
    name: video.name,
    md5: video.md5 ?? null,
    uploadedAt: new Date().toISOString(),
  }), 30)

export const forgetUpload = (accountId, video) => deadline(deleteDoc(doc(db, UPLOADS, uploadKey(accountId, video))), 30)
