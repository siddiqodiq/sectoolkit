// app/api/knowledge/upload/route.ts - Update dengan PDF.js
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { existsSync } from 'fs'

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

    // Validate file type
    const allowedTypes = ['text/plain', 'application/pdf', 'text/markdown']
    if (!allowedTypes.includes(file.type)) {
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
    const fileExtension = file.name.split('.').pop()
    const fileName = `${fileId}.${fileExtension}`
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads', 'knowledge')
    
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }
    
    // Convert file to buffer and save
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filePath = join(uploadsDir, fileName)
    
    await writeFile(filePath, buffer)

    // Save file metadata to database
    const knowledgeFile = await prisma.knowledge.create({
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

    // Process file for text extraction (background task)
    processFileForEmbedding(fileId, filePath, file.type, file.name)

    return NextResponse.json({
      success: true,
      file: {
        id: knowledgeFile.id,
        name: knowledgeFile.name,
        size: knowledgeFile.size,
        status: knowledgeFile.status
      }
    })
  } catch (error) {
    console.error('Error uploading knowledge file:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// ✅ Enhanced processing function dengan PDF.js
async function processFileForEmbedding(fileId: string, filePath: string, mimeType: string, originalName: string) {
  try {
    console.log(`📄 Processing file: ${originalName} (${mimeType})`)
    console.log(`📁 File path: ${filePath}`)
    
    // Check if file exists
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }
    
    // Extract text based on file type
    let extractedText = ''
    
    switch (mimeType) {
      case 'text/plain':
      case 'text/markdown':
        extractedText = await extractTextFile(filePath)
        break
      
      case 'application/pdf':
        extractedText = await extractPdfWithPdfJs(filePath, originalName)
        break
        
      default:
        throw new Error(`Unsupported file type: ${mimeType}`)
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No readable text content extracted from file')
    }

    console.log(`✅ Extracted ${extractedText.length} characters from ${originalName}`)
    
    // Save extracted text for debugging and future use
    const extractedFilePath = filePath.replace(/\.[^/.]+$/, '.extracted.txt')
    await writeFile(extractedFilePath, extractedText, 'utf-8')
    console.log(`💾 Saved extracted text to: ${extractedFilePath}`)
    
    // Update database with success status
    await prisma.knowledge.update({
      where: { id: fileId },
      data: { 
        status: 'active',
        chunks: Math.ceil(extractedText.length / 1000) // Estimate chunks
      }
    })
    
    console.log(`✅ File ${originalName} processed successfully`)
  } catch (error) {
    console.error('Error processing file for embedding:', error)
    await prisma.knowledge.update({
      where: { id: fileId },
      data: { status: 'error' }
    })
  }
}

// ✅ Text file extraction
async function extractTextFile(filePath: string): Promise<string> {
  const { readFile } = await import('fs/promises')
  return await readFile(filePath, 'utf-8')
}

// ✅ PDF.js text extraction
async function extractPdfWithPdfJs(filePath: string, originalName: string): Promise<string> {
  try {
    console.log(`📚 Extracting PDF with PDF.js: ${originalName}`)
    
    // Dynamic import PDF.js
    const pdfParse = await import('pdfjs-dist')
    
    // Read PDF file
    const { readFile } = await import('fs/promises')
    const pdfBuffer = await readFile(filePath)
    
    console.log(`📄 PDF buffer size: ${pdfBuffer.length} bytes`)
    
    // Load PDF document
    const loadingTask = pdfParse.getDocument({
      data: new Uint8Array(pdfBuffer),
      verbosity: 0 // Reduce console output
    })
    
    const pdf = await loadingTask.promise
    
    console.log(`📖 PDF loaded successfully: ${pdf.numPages} pages`)
    
    let extractedText = ''
    let processedPages = 0
    const maxPages = Math.min(pdf.numPages, 50) // Limit to 50 pages for performance
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        console.log(`📑 Processing page ${pageNum}/${maxPages}...`)
        
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        
        // Extract text items from page
        const pageText = textContent.items
          .map((item: any) => {
            // Handle different item types
            if (typeof item.str === 'string') {
              return item.str
            }
            return ''
          })
          .filter(text => text.trim().length > 0)
          .join(' ')
        
        if (pageText.trim().length > 0) {
          extractedText += `\n\n--- Page ${pageNum} ---\n${pageText}`
          processedPages++
        }
        
        // Add small delay to prevent overwhelming the system
        if (pageNum % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
      } catch (pageError) {
        console.log(`⚠️ Error processing page ${pageNum}:`, pageError)
        // Continue with next page instead of failing completely
      }
    }
    
    console.log(`✅ PDF.js extraction completed: ${processedPages}/${maxPages} pages processed`)
    
    if (extractedText.trim().length === 0) {
      throw new Error(`No readable text found in PDF after processing ${maxPages} pages`)
    }
    
    // Clean and format the extracted text
    const cleanedText = cleanExtractedText(extractedText)
    
    console.log(`📝 Final extracted text length: ${cleanedText.length} characters`)
    
    return cleanedText
    
  } catch (error) {
    console.error('❌ PDF.js extraction error:', error)
    throw new Error(`Failed to extract text from PDF using PDF.js: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// ✅ Helper function to clean extracted text
function cleanExtractedText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Fix line breaks
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // Remove page headers/footers patterns
    .replace(/--- Page \d+ ---\s*/g, '\n\n')
    // Remove non-printable characters except newlines and tabs
    .replace(/[^\x20-\x7E\n\t]/g, '')
    // Trim
    .trim()
}