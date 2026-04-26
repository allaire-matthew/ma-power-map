import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getDatabase, type Database } from 'firebase/database'
import { firebaseConfig } from './firebaseConfig'

let appPromise: Promise<{ app: FirebaseApp; db: Database } | null> | null = null

export function getFirebase() {
  if (!firebaseConfig) return Promise.resolve(null)
  if (!appPromise) {
    appPromise = (async () => {
      const app = initializeApp(firebaseConfig)
      await signInAnonymously(getAuth(app))
      return { app, db: getDatabase(app) }
    })()
  }
  return appPromise
}

export const BOARD_PATH = 'boards/ma-power-map'
