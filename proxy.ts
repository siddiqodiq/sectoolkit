import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    if (req.nextUrl.pathname.startsWith('/api/tools')) {
      const token = req.nextauth.token
      if (!token) {
        return NextResponse.json(
          { error: 'Unauthorized access. You must be logged in to execute tools.' },
          { status: 401 }
        )
      }
    }
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        // For API routes, bypass the default redirect to login page
        // so that the middleware function can return a 401 JSON response
        if (req.nextUrl.pathname.startsWith('/api/tools')) {
          return true
        }
        // For other protected routes, return true if logged in
        return !!token
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: [
    '/tools/:path*',
    '/database/:path*',
    '/api/tools/:path*',
  ],
}