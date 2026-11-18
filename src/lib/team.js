// Firestore storage for the team portal (see firestore.rules):
// - teamMembers/{email}: who may open /team, keyed by lowercase Google email. Owner writes; each person can read their own.
// - People can ask to join at /team/join: that makes a teamRequests/{email} entry, which gives no
//   access. The owner approves it at /admin/team (they become a member, `signedUp: true`) or
//   declines it (their email goes in teamBlocked/{email} so they can't ask again).
// - teamMembers also lists the owner (added automatically, `owner: true`) so the team can message them.
// - portal/welcome: the portal's welcome heading and message. Owner writes; team members read.
import { getApp } from 'firebase/app'
import { collection, deleteDoc, doc, getDoc, getDocsFromServer, initializeFirestore, setDoc } from 'firebase/firestore'

// Same settings as lib/campaignRuns.js: with identical settings Firebase hands back the one shared
// instance whichever file loads first (different settings would throw).
export const db = initializeFirestore(getApp(), { ignoreUndefinedProperties: true })
const MEMBERS = 'teamMembers'
const BLOCKED = 'teamBlocked'
const REQUESTS = 'teamRequests'
const WELCOME = doc(db, 'portal', 'welcome')

// Firestore retries forever while it can't reach the server, so every call gets a deadline.
export function deadline(promise, seconds = 15) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Couldn't reach Firestore. Check your connection.")), seconds * 1000)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export const memberId = (email) => email.trim().toLowerCase()

// The signed-in person's own membership, or null when they are not on the team.
export async function getMembership(email) {
  try {
    const snap = await deadline(getDoc(doc(db, MEMBERS, memberId(email))))
    return snap.exists() ? snap.data() : null
  } catch (err) {
    if (err.code === 'permission-denied') return null
    throw err
  }
}

// The owner needs a team entry too, so people can find and message them. Returns it.
export async function ensureOwnerMember(user) {
  const existing = await getMembership(user.email)
  if (existing) return existing
  const member = { email: memberId(user.email), name: user.displayName ?? '', role: '', owner: true, addedAt: new Date().toISOString() }
  await deadline(setDoc(doc(db, MEMBERS, member.email), member))
  return member
}

// { heading, message } or null when none has been saved.
export async function getWelcome() {
  const snap = await deadline(getDoc(WELCOME))
  return snap.exists() ? snap.data() : null
}

// Everyone on the team, by email.
export async function listMembers() {
  const snap = await deadline(getDocsFromServer(collection(db, MEMBERS)))
  return snap.docs.map((d) => d.data()).sort((a, b) => a.email.localeCompare(b.email))
}

// Asks to join the team, as the signed-in person (see firestore.rules: their own email, once).
// It gives no access until the owner approves it.
export async function requestToJoin(user, { name, role }) {
  const request = { email: memberId(user.email), name: name.trim().slice(0, 80), role: role.trim().slice(0, 80), at: new Date().toISOString() }
  await deadline(setDoc(doc(db, REQUESTS, request.email), request))
  return request
}
// The signed-in person's own request, or null.
export async function getRequest(email) {
  try {
    const snap = await deadline(getDoc(doc(db, REQUESTS, memberId(email))))
    return snap.exists() ? snap.data() : null
  } catch {
    return null
  }
}

// Whether the owner has blocked this email from signing up.
export async function isBlocked(email) {
  try {
    return (await deadline(getDoc(doc(db, BLOCKED, memberId(email))))).exists()
  } catch {
    return false
  }
}

// Owner only from here down.
// Everyone waiting for approval, oldest first.
export async function listRequests() {
  const snap = await deadline(getDocsFromServer(collection(db, REQUESTS)))
  return snap.docs.map((d) => d.data()).sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''))
}
// Approves a request: they become a team member. Returns their member entry.
export async function approveRequest(request) {
  const member = { email: memberId(request.email), name: request.name ?? '', role: request.role ?? '', addedAt: new Date().toISOString(), signedUp: true }
  await deadline(setDoc(doc(db, MEMBERS, member.email), member))
  await deadline(deleteDoc(doc(db, REQUESTS, member.email)))
  return member
}
// Declines a request and blocks that email, so it can't simply ask again.
export async function declineRequest(email) {
  await deadline(setDoc(doc(db, BLOCKED, memberId(email)), { email: memberId(email), at: new Date().toISOString() }))
  await deadline(deleteDoc(doc(db, REQUESTS, memberId(email))))
}
export async function listBlocked() {
  const snap = await deadline(getDocsFromServer(collection(db, BLOCKED)))
  return snap.docs.map((d) => d.data()).sort((a, b) => a.email.localeCompare(b.email))
}
export const unblockMember = (email) => deadline(deleteDoc(doc(db, BLOCKED, memberId(email))))

export async function addMember({ email, name, role }) {
  const member = { email: memberId(email), name: name.trim(), role: role.trim(), addedAt: new Date().toISOString() }
  await deadline(setDoc(doc(db, MEMBERS, member.email), member))
  return member
}

export const removeMember = (email) => deadline(deleteDoc(doc(db, MEMBERS, memberId(email))))

export async function saveWelcome({ heading, message }) {
  const welcome = { heading: heading.trim(), message: message.trim(), updatedAt: new Date().toISOString() }
  await deadline(setDoc(WELCOME, welcome))
  return welcome
}
