// To enable shared editing across browsers, paste your Firebase web-app
// config here. The web API key is safe to commit; database security is
// enforced by Realtime Database rules (see README).
//
// Steps:
//   1. https://console.firebase.google.com → create a project
//   2. Build → Realtime Database → create (any region)
//   3. Build → Authentication → enable Anonymous provider
//   4. Project settings → Your apps → Web app → register → copy the config
//   5. Replace the export below with the config object (keep `as const`)
//
// While this remains `null`, the app persists to localStorage only.

export type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  databaseURL: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId?: string
}

export const firebaseConfig: FirebaseWebConfig | null = null
