// app/api/knowledge/files/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user files
    const userFiles = await prisma.knowledge.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        size: true,
        uploadedAt: true,
        status: true,
        chunks: true
      },
      orderBy: { uploadedAt: 'desc' }
    })

    // Get application knowledge base files (mock data for now)
    const applicationFiles = [
      {
        id: 'app-1',
        name: 'OWASP Top 10 Guide',
        size: 1024 * 1024 * 2, // 2MB
        type: 'application' as const,
        uploadedAt: '2024-01-01',
        status: 'active' as const,
        chunks: 150
      },
      {
        id: 'app-2', 
        name: 'Penetration Testing Methodologies',
        size: 1024 * 1024 * 5, // 5MB
        type: 'application' as const,
        uploadedAt: '2024-01-01',
        status: 'active' as const,
        chunks: 320
      },
      {
        id: 'app-3',
        name: 'Common Vulnerabilities Database',
        size: 1024 * 1024 * 3, // 3MB
        type: 'application' as const,
        uploadedAt: '2024-01-01',
        status: 'active' as const,
        chunks: 200
      }
    ]

    const formattedUserFiles = userFiles.map((file: any) => ({
      ...file,
      type: 'user' as const
    }))

    return NextResponse.json({
      files: [...applicationFiles, ...formattedUserFiles]
    })
  } catch (error) {
    console.error('Error fetching knowledge files:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}