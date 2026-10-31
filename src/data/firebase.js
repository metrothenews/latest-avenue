// Firebase settings for owner-only Google sign-in (/login → /admin). Setup steps are in README.md → "Owner login".
// The web config isn't secret (it ships to every browser); access is enforced by `ownerUid` here
// and, for any stored data, by the Firestore rules in firestore.rules.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
}

// Your Firebase user ID. Sign in once at /login and the page shows it; paste it here
// and into firestore.rules. Until it's set, nobody can open /admin.
export const ownerUid = ''
