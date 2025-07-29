// app/api/knowledge/files/route.ts - Update untuk remove application files
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

    // ✅ Only get user files (remove application files)
    const userFiles = await prisma.knowledge.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    })

    const formattedFiles = userFiles.map(file => ({
      id: file.id,
      name: file.name,
      size: file.size,
      type: 'user' as const, // Always user type now
      uploadedAt: file.uploadedAt.toISOString(),
      status: file.status,
      chunks: file.chunks,
      ingested: file.ingested
    }))

    return NextResponse.json({
      files: formattedFiles
    })
  } catch (error) {
    console.error('Error getting knowledge files:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}