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
    const files = formData.getAll('files') as File[] // <-- Gunakan getAll('files')
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const uploadsDir = join(process.cwd(), 'uploads', 'knowledge')
    await mkdir(uploadsDir, { recursive: true })

    const results = []

    for (const file of files) {
      // --- Lakukan validasi untuk setiap file ---
      const allowedMimeTypes = ['text/plain', 'application/pdf', 'text/markdown'];
      const allowedExtensions = ['.txt', '.pdf', '.md'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

      if ((!allowedMimeTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) || file.size > 10 * 1024 * 1024) {
        console.warn(`Skipping invalid file: ${file.name}`)
        continue; // Skip file ini dan lanjut ke berikutnya
      }

      // --- Proses setiap file yang valid ---
      const fileId = uuidv4()
      const fileName = `${fileId}${fileExtension}` // Gunakan fileExtension yang sudah diekstrak
      const filePath = join(uploadsDir, fileName)
      
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)

      const knowledge = await prisma.knowledge.create({
        data: {
          id: fileId,
          name: file.name,
          fileName: fileName,
          filePath: filePath,
          size: file.size,
          mimeType: file.type || 'application/octet-stream', // Fallback mimeType
          userId: session.user.id,
          status: 'active' // Langsung set 'active' untuk disederhanakan
        }
      })
      results.push(knowledge)
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      files: results.map(k => ({ id: k.id, name: k.name }))
    })

  } catch (error) {
    console.error('Error uploading knowledge file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
/*
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
} */