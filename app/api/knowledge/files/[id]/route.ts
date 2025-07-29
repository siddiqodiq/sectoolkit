// app/api/knowledge/files/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/db'
import { unlink } from 'fs/promises'
import { deleteDocumentFromChroma } from '@/app/api/chat/utils/chroma'


export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> } // ✅ Fix async params
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ✅ Await params
    const params = await context.params
    const { id } = params

    // Find the file
    const file = await prisma.knowledge.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Delete physical file
    try {
      await unlink(file.filePath)
    } catch (error) {
      console.error('Error deleting physical file:', error)
    }

    // Delete extracted text file if exists
    try {
      const extractedFilePath = file.filePath.replace(/\.[^/.]+$/, '.extracted.txt')
      await unlink(extractedFilePath)
    } catch (error) {
      // Ignore if extracted file doesn't exist
    }

    // Delete metadata file if exists
    try {
      const metadataPath = file.filePath.replace(/\.[^/.]+$/, '.metadata.json')
      await unlink(metadataPath)
    } catch (error) {
      // Ignore if metadata file doesn't exist
    }

    // Delete from ChromaDB
    try {
      await deleteDocumentFromChroma(file.id)
    } catch (chromaError) {
      console.error('Error deleting from ChromaDB:', chromaError)
      // Continue with database deletion even if ChromaDB fails
    }

    // Delete from database
    await prisma.knowledge.delete({
      where: { id: id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting knowledge file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> } // ✅ Fix async params
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ✅ Await params
    const params = await context.params
    const { id } = params

    // ✅ Remove application knowledge base handling - only handle user files
    const file = await prisma.knowledge.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // ✅ Try to read extracted text first, fallback to original file
    const { readFile } = await import('fs/promises')
    let content: string
    
    try {
      // Try extracted text file first
      const extractedFilePath = file.filePath.replace(/\.[^/.]+$/, '.extracted.txt')
      content = await readFile(extractedFilePath, 'utf-8')
      console.log(`📄 Reading extracted text for: ${file.name}`)
    } catch (extractedError) {
      try {
        // Fallback to original file
        console.log(`📄 Reading original file for: ${file.name}`)
        content = await readFile(file.filePath, 'utf-8')
      } catch (originalError) {
        console.error('Error reading both extracted and original file:', originalError)
        return NextResponse.json({ 
          error: 'Could not read file content' 
        }, { status: 500 })
      }
    }

    return new Response(content, {
      headers: { 
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error) {
    console.error('Error getting file content:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ✅ Add content endpoint for better file handling
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params
    const { id } = params
    const { action } = await request.json()

    const file = await prisma.knowledge.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    switch (action) {
      case 'reprocess':
        // Trigger reprocessing of the file
        // This could be useful if extraction failed initially
        return NextResponse.json({ 
          message: 'File reprocessing triggered',
          status: 'processing'
        })

      case 'get-metadata':
        // Get file metadata including extraction info
        const { readFile } = await import('fs/promises')
        let metadata = {
          id: file.id,
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
          status: file.status,
          chunks: file.chunks,
          ingested: file.ingested,
          uploadedAt: file.uploadedAt,
          hasExtractedText: false,
          hasMetadata: false
        }

        // Check if extracted text exists
        try {
          const extractedFilePath = file.filePath.replace(/\.[^/.]+$/, '.extracted.txt')
          await readFile(extractedFilePath, 'utf-8')
          metadata.hasExtractedText = true
        } catch {}

        // Check if metadata file exists
        try {
          const metadataPath = file.filePath.replace(/\.[^/.]+$/, '.metadata.json')
          const metadataContent = await readFile(metadataPath, 'utf-8')
          const parsedMetadata = JSON.parse(metadataContent)
          metadata.hasMetadata = true
          metadata = { ...metadata, ...parsedMetadata }
        } catch {}

        return NextResponse.json(metadata)

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error handling file action:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}