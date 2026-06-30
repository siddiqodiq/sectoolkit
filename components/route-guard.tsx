// components/route-guard.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useSession } from "next-auth/react"

interface RouteGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
}

export function RouteGuard({ children, requireAuth = true }: RouteGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)
  const { data: session, status } = useSession()

  useEffect(() => {
    const publicPaths = ['/', '/login', '/register']
    const authCheck = () => {
      // Skip auth check if not required
      if (!requireAuth) {
        setAuthorized(true)
        return
      }

      // If route requires auth and user is not logged in
      if (requireAuth && status === 'unauthenticated' && !publicPaths.includes(pathname)) {
        setAuthorized(false)
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`)
      } else {
        setAuthorized(true)
      }
    }

    authCheck()
  }, [pathname, session, status, requireAuth, router])

  if (status === 'loading' || !authorized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}