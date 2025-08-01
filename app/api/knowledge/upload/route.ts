// app/api/knowledge/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // FIX: Validate by extension as well, to match frontend logic
    const allowedMimeTypes = ['text/plain', 'application/pdf', 'text/markdown'];
    const allowedExtensions = ['.txt', '.pdf', '.md'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowedMimeTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only .txt, .pdf, and .md files are supported' 
      }, { status: 400 })
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 10MB' 
      }, { status: 400 })
    }

    // Generate unique filename
    const fileId = uuidv4()
    const fileName = `${fileId}.${fileExtension}`
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads', 'knowledge')
    
    // ✅ Ensure directory exists
    await mkdir(uploadsDir, { recursive: true })
    
    // Convert file to buffer and save
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filePath = join(uploadsDir, fileName)
    
    await writeFile(filePath, buffer)

    // Save file metadata to database
    const knowledge = await prisma.knowledge.create({
      data: {
        id: fileId,
        name: file.name,
        fileName: fileName,
        filePath: filePath,
        size: file.size,
        mimeType: file.type,
        userId: session.user.id,
        status: 'processing'
      }
    })

    // Process file for embedding (background task)
    processFileForEmbedding(fileId, filePath, file.type)

    return NextResponse.json({
      success: true,
      file: {
        id: knowledge.id,
        name: knowledge.name,
        size: knowledge.size,
        status: knowledge.status
      }
    })
  } catch (error) {
    console.error('Error uploading knowledge file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function processFileForEmbedding(fileId: string, filePath: string, mimeType: string) {
  try {
    // Process file and create embeddings
    // This would integrate with your ChromaDB setup
    
    // For now, just update status to active
    await prisma.knowledge.update({
      where: { id: fileId },
      data: { 
        status: 'active',
        chunks: Math.floor(Math.random() * 100) + 50 // Mock chunk count
      }
    })
  } catch (error) {
    console.error('Error processing file for embedding:', error)
    await prisma.knowledge.update({
      where: { id: fileId },
      data: { status: 'error' }
    })
  }
}