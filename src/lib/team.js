// Firestore storage for the team portal (see firestore.rules):
// - teamMembers/{email}: who may open /team, keyed by lowercase Google email. Owner writes; each person can read their own.
// - portal/welcome: the portal's welcome heading and message. Owner writes; team members read.
import { getApp } from 'firebase/app'
import { collection, deleteDoc, doc, getDoc, getDocsFromServer, initializeFirestore, setDoc } from 'firebase/firestore'

// Same settings as lib/campaignRuns.js: with identical settings Firebase hands back the one shared
// instance whichever file loads first (different settings would throw).
const db = initializeFirestore(getApp(), { ignoreUndefinedProperties: true })
const MEMBERS = 'teamMembers'
const WELCOME = doc(db, 'portal', 'welcome')

// Firestore retries forever while it can't reach the server, so every call gets a deadline.
function deadline(promise, seconds = 15) {
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

// { heading, message } or null when none has been saved.
export async function getWelcome() {
  const snap = await deadline(getDoc(WELCOME))
  return snap.exists() ? snap.data() : null
}

// Owner only from here down.
export async function listMembers() {
  const snap = await deadline(getDocsFromServer(collection(db, MEMBERS)))
  return snap.docs.map((d) => d.data()).sort((a, b) => a.email.localeCompare(b.email))
}

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
