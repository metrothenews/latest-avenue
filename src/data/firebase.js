// Firebase settings for owner-only Google sign-in (/login → /admin). Setup steps are in README.md → "Owner login".
// The web config isn't secret (it ships to every browser); access is enforced by `ownerUid` here
// and, for any stored data, by the Firestore rules in firestore.rules.
export const firebaseConfig = {
  apiKey: 'AIzaSyClwpXvwr-4UFDDCIWBlZsIZfncrDKPC5k',
  authDomain: 'latest-avenue-app.firebaseapp.com',
  projectId: 'latest-avenue-app',
  appId: '1:91445930665:web:cc1c22052b6ae8bcf617b8',
}

// The Realtime Database (the live link for the /experience phone controller; see README →
// "The /experience view"). This is the address the Firebase console shows on its Realtime
// Database page once the database has been created there.
export const databaseURL = 'https://latest-avenue-app-default-rtdb.firebaseio.com'

// Your Firebase user ID. Sign in once at /login and the page shows it; paste it here
// and into firestore.rules. Until it's set, nobody can open /admin.
export const ownerUid = 'cUUEuJ7NRCZVuMNhSxOr7yzA8DX2' // metrothenews@gmail.com
