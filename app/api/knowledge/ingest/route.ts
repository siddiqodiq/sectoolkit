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

    // Create a streaming response
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Initialize ChromaDB
          controller.enqueue(encoder.encode(`${JSON.stringify({
            status: "Initializing ChromaDB...",
            progress: 10
          })}\n`))

          await initializeChroma()

          // Get files from database
          const files = await prisma.knowledge.findMany({
            where: {
              id: { in: fileIds },
              userId: session.user.id,
              status: 'active'
            }
          })

          if (files.length === 0) {
            controller.enqueue(encoder.encode(`${JSON.stringify({
              error: "No valid files found for ingestion"
            })}\n`))
            controller.close()
            return
          }

          const totalFiles = files.length
          let processedFiles = 0

          for (const file of files) {
            try {
              controller.enqueue(encoder.encode(`${JSON.stringify({
                status: `Processing ${file.name}...`,
                progress: 20 + (processedFiles / totalFiles) * 60
              })}\n`))

              // Read file content
              const fileContent = await readFile(file.filePath, 'utf-8')
              
              // Ingest to ChromaDB
              const chunks = await ingestDocumentToChroma(
                fileContent,
                {
                  source: file.name,
                  fileId: file.id,
                  userId: session.user.id,
                  uploadedAt: file.uploadedAt.toISOString()
                }
              )

              // Update database status
              await prisma.knowledge.update({
                where: { id: file.id },
                data: {
                  status: 'active',
                  chunks: chunks,
                  // Add ingested field to schema if not exists
                }
              })

              processedFiles++
              
              controller.enqueue(encoder.encode(`${JSON.stringify({
                status: `${file.name} ingested successfully (${chunks} chunks)`,
                progress: 20 + (processedFiles / totalFiles) * 60
              })}\n`))

            } catch (fileError) {
              console.error(`Error processing file ${file.name}:`, fileError)
              
              // Update file status to error
              await prisma.knowledge.update({
                where: { id: file.id },
                data: { status: 'error' }
              })

              controller.enqueue(encoder.encode(`${JSON.stringify({
                status: `Error processing ${file.name}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`,
                progress: 20 + (processedFiles / totalFiles) * 60
              })}\n`))
            }
          }

          // Final completion
          controller.enqueue(encoder.encode(`${JSON.stringify({
            status: "Ingestion completed successfully!",
            progress: 100,
            complete: true,
            processedFiles: processedFiles,
            totalFiles: totalFiles
          })}\n`))

          controller.close()

        } catch (error) {
          console.error('Ingestion error:', error)
          controller.enqueue(encoder.encode(`${JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            progress: 0
          })}\n`))
          controller.close()
        }
      }
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Ingestion route error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}