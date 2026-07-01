import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  // Hanya lindungi route /api/tools/* (dan bisa ditambahkan path lain jika perlu)
  if (request.nextUrl.pathname.startsWith('/api/tools')) {
    // Mengambil token sesi NextAuth dari request
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    
    // Jika tidak ada token (user belum login), tolak akses dengan 401 Unauthorized
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized access. You must be logged in to execute tools.' },
        { status: 401 }
      )
    }
  }
  
  return NextResponse.next()
}

export const config = {
  // Tentukan path mana saja yang akan dilewati ke middleware ini
  matcher: ['/api/tools/:path*'],
}
