import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface AuthState {
  sessionToken: string | null
  salt: string | null
  isInitialized: boolean
  expiresAt: number | null
}

interface AuthActions {
  login: (password: string) => Promise<boolean>
  logout: () => void
  validateSession: () => Promise<boolean>
}

type AuthStore = AuthState & AuthActions

// Helper to generate a random salt
const generateSalt = () => {
  const array = new Uint8Array(16)
  window.crypto.getRandomValues(array)
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Helper to compute SHA-256 hash
const computeHash = async (message: string) => {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      sessionToken: null,
      salt: null,
      isInitialized: false,
      expiresAt: null,

      login: async (password: string) => {
        const correctPassword = import.meta.env.OKI_ACCESS_PASSWORD
        // If no password configured, always allow
        if (!correctPassword) {
          return true
        }

        if (password === correctPassword) {
          const salt = generateSalt()
          const token = await computeHash(correctPassword + salt)

          // 设置过期时间：当前时间 + 7天的毫秒数
          const sevenDays = 7 * 24 * 60 * 60 * 1000
          const expiresAt = Date.now() + sevenDays

          set({ sessionToken: token, salt, isInitialized: true, expiresAt })
          return true
        }
        return false
      },

      logout: () => set({ sessionToken: null, salt: null, expiresAt: null, isInitialized: true }),

      validateSession: async () => {
        const { sessionToken, salt, expiresAt } = get()
        const correctPassword = import.meta.env.OKI_ACCESS_PASSWORD

        // 检查是否过期
        if (expiresAt && Date.now() > expiresAt) {
          set({ sessionToken: null, salt: null, expiresAt: null })
          return false
        }

        // If no password configured, always valid
        if (!correctPassword) {
          return true
        }

        // If no token or salt, invalid
        if (!sessionToken || !salt) {
          return false
        }

        // Re-compute hash to verify
        const expectedToken = await computeHash(correctPassword + salt)
        if (sessionToken === expectedToken) {
          return true
        } else {
          // Invalid token (tampered or changed password), clear it
          set({ sessionToken: null, salt: null })
          return false
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ sessionToken: state.sessionToken, salt: state.salt,expiresAt: state.expiresAt }),
    },
  ),
)
