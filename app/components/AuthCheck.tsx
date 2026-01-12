'use client'

import { useEffect, useRef } from 'react'
import { getSession, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export function AuthCheck() {
  const { status } = useSession()
  const router = useRouter()
  const didAttemptRef = useRef(false)

  useEffect(() => {
    if (status !== 'unauthenticated') return
    if (didAttemptRef.current) return

    didAttemptRef.current = true

    // Ensure we have a session before hitting authenticated APIs like /api/chat.
    // This route performs a credentials sign-in server-side and sets cookies.
    fetch('/api/auth/auto-login', { method: 'POST' })
      .then(async () => {
        // Update the client session cache, then refresh server components that depend on auth().
        await getSession()
        router.refresh()
      })
      .catch(() => {
        // Allow retry on next render if the request failed
        didAttemptRef.current = false
      })
  }, [status, router])

  return null
} 