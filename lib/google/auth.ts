import { GoogleAuth, type JWTInput } from 'google-auth-library'

export function createGoogleAuth(credentials: JWTInput) {
  const clientPromise = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  }).getClient()

  return {
    clientPromise,
    getToken: async () => {
      const client = await clientPromise
      if (!client) {
        throw new Error('Google auth not configured')
      }
      const { token } = await client.getAccessToken()
      if (!token) {
        throw new Error('Failed to obtain Google auth token')
      }
      return token
    },
  } as const
}

export function assertToken(token: unknown): asserts token is string {
  if (!token || typeof token !== 'string') {
    throw new Error(`Missing required Google auth configuration`)
  }
}
