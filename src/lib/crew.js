// Firestore storage for the crew (see firestore.rules):
// - crew/{email}: one person on a project, keyed by their lowercase Google email:
//   { email, firstName, lastName, project, role, phone, addedAt }.
//   The owner writes and lists them (the Crew section of /admin/team); each person can read only
//   their own. Being listed lets them sign in at /team/crew and view the note boards (read-only).
import { collection, deleteDoc, doc, getDoc, getDocsFromServer, setDoc } from 'firebase/firestore'
import { db, deadline, memberId } from './team.js'

const CREW = 'crew'

// The signed-in person's own crew entry, or null when they haven't been added.
export async function getCrewMember(email) {
  try {
    const snap = await deadline(getDoc(doc(db, CREW, memberId(email))))
    return snap.exists() ? snap.data() : null
  } catch (err) {
    if (err.code === 'permission-denied') return null
    throw err
  }
}

// Everyone on the crew, by project then name (owner only).
export async function listCrew() {
  const snap = await deadline(getDocsFromServer(collection(db, CREW)))
  return snap.docs.map((d) => d.data()).sort(byProjectThenName)
}

export const byProjectThenName = (a, b) =>
  a.project.localeCompare(b.project) || a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName)

// Adds a person, or replaces the entry already saved under that email. Returns what was saved.
export async function addCrewMember({ email, firstName, lastName, project, role, phone }) {
  const member = {
    email: memberId(email), firstName: firstName.trim(), lastName: lastName.trim(),
    project: project.trim(), role: role.trim(), phone: phone.trim(), addedAt: new Date().toISOString(),
  }
  await deadline(setDoc(doc(db, CREW, member.email), member))
  return member
}

export const removeCrewMember = (email) => deadline(deleteDoc(doc(db, CREW, memberId(email))))
