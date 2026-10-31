import { createContext, useContext, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, firebaseConfigured } from '../../lib/firebase.js'
import { clearDriveToken } from '../../lib/driveAuth.js'
import { ownerUid } from '../../data/firebase.js'

const AuthContext = createContext(null)

const ERRORS = {
  'auth/unauthorized-domain': "This domain isn't authorized. Add it in Firebase → Authentication → Settings → Authorized domains.",
  'auth/popup-blocked': 'Your browser blocked the sign-in popup. Allow popups for this site and try again.',
  'auth/operation-not-allowed': 'Google sign-in is turned off. Enable it in Firebase → Authentication → Sign-in method.',
}
const IGNORED = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request']

export function useAuth() {
  return useContext(AuthContext)
}

// Layout route that provides { user, loading, isOwner, signIn, signOut } to /login and /admin.
// Lazy-loaded from App.jsx so Firebase isn't in the bundle for public pages.
export default function AuthProvider() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(firebaseConfigured)

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  async function signIn() {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
      return ''
    } catch (err) {
      if (IGNORED.includes(err.code)) return ''
      return ERRORS[err.code] ?? `Sign-in failed (${err.code ?? err.message}).`
    }
  }

  const value = {
    configured: firebaseConfigured,
    user,
    loading,
    isOwner: Boolean(user && ownerUid && user.uid === ownerUid),
    signIn,
    signOut: () => {
      clearDriveToken()
      return signOut(auth)
    },
  }

  return <AuthContext.Provider value={value}><Outlet /></AuthContext.Provider>
}
