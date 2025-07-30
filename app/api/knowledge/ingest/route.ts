// app/api/knowledge/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/db'
import { initializeChroma, ingestDocumentToChroma } from '@/app/api/chat/utils/chroma'
import { readFile } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileIds } = await request.json()
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'File IDs are required' }, { status: 400 })
    }

    await initializeChroma()

    const files = await prisma.knowledge.findMany({
      where: {
        id: { in: fileIds },
        userId: session.user.id,
        status: 'active'
      }
    })

    if (files.length === 0) {
      return NextResponse.json({ error: "No valid files found for ingestion" }, { status: 400 })
    }

    let processedFiles = 0
    let results: Array<{ fileId: string, fileName: string, status: string, chunks?: number, error?: string }> = []

    for (const file of files) {
      try {
        const fileContent = await readFile(file.filePath, 'utf-8')
        const chunks = await ingestDocumentToChroma(
          fileContent,
          {
            source: file.name,
            fileId: file.id,
            userId: session.user.id,
            uploadedAt: file.uploadedAt.toISOString()
          }
        )

        await prisma.knowledge.update({
          where: { id: file.id },
          data: {
            status: 'active',
            chunks: chunks,
          }
        })

        processedFiles++
        results.push({
          fileId: file.id,
          fileName: file.name,
          status: 'success',
          chunks
        })
      } catch (fileError) {
        await prisma.knowledge.update({
          where: { id: file.id },
          data: { status: 'error' }
        })
        results.push({
          fileId: file.id,
          fileName: file.name,
          status: 'error',
          error: fileError instanceof Error ? fileError.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      status: "Ingestion completed",
      processedFiles,
      totalFiles: files.length,
      results
    })

  } catch (error) {
    console.error('Ingestion route error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}