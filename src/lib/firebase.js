import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { firebaseConfig } from '../data/firebase.js'

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain)

// null until data/firebase.js is filled in.
export const auth = firebaseConfigured ? getAuth(initializeApp(firebaseConfig)) : null
