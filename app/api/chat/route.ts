import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { ChatOllama } from '@langchain/community/chat_models/ollama'
import { ConversationChain } from 'langchain/chains'
import { BufferMemory } from 'langchain/memory'
import { ChatMessageHistory } from 'langchain/stores/message/in_memory'
import { AIMessage, HumanMessage } from '@langchain/core/messages'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const { messages, chatId } = await req.json()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Pastikan chatId valid dan ambil riwayat percakapan
  let chat = null
  let previousMessages: { type: string; data: { content: string } }[] = []
  if (chatId) {
    chat = await prisma.chat.findUnique({
      where: {
        id: chatId,
        userId: session.user.id
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 10 // Ambil 10 pesan terakhir saja
        }
      }
    })
    
    if (chat) {
      previousMessages = chat.messages.map(msg => ({
        type: msg.role === 'USER' ? 'human' : 'ai',
        data: { content: msg.content }
      }))
    }
  }

  // Jika tidak ada chatId atau chat tidak ditemukan, buat baru
  if (!chat) {
    chat = await prisma.chat.create({
      data: {
        userId: session.user.id,
        title: messages.find((m: { role: string }) => m.role === 'user')?.content.substring(0, 50) || 'New Chat',
        modelUsed: process.env.OLLAMA_MODEL || 'pentest-ai'
      }
    })
  }

  // Simpan pesan user ke database
  const userMessage = messages[messages.length - 1]
  if (userMessage.role === 'user') {
    await prisma.message.create({
      data: {
        chatId: chat.id,
        content: userMessage.content,
        role: 'USER'
      }
    })
  }

  try {
    console.log('🔗 Connecting to Ollama at:', process.env.OLLAMA_HOST)

    // Buat array pesan untuk Ollama
    const allMessages: any[] = []
    
    // Tambahkan pesan sebelumnya
    for (const msg of previousMessages) {
      if (msg.type === 'human') {
        allMessages.push(new HumanMessage(msg.data.content))
      } else {
        allMessages.push(new AIMessage(msg.data.content))
      }
    }
    
    // Tambahkan pesan user baru
    allMessages.push(new HumanMessage(userMessage.content))

    // Buat ChatOllama instance
    const llm = new ChatOllama({
      baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'pentest-ai',
      temperature: 0.7,
      // Enable streaming
      disableStreaming: false,
    })

    console.log('💬 Starting real-time stream from Ollama...')
    
    // Buat real-time streaming response
    const encoder = new TextEncoder()
    let fullResponse = ''
    
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Stream dari LLM langsung
          const stream = await llm.stream(allMessages)
          
          for await (const chunk of stream) {
            const content = chunk.content
            
            if (content) {
              const contentStr = typeof content === 'string' ? content : JSON.stringify(content)
              fullResponse += contentStr
              
              // Kirim chunk secara real-time
              controller.enqueue(encoder.encode(contentStr))
            }
          }

          console.log('✅ Streaming completed')

          // Simpan response AI ke database setelah streaming selesai
          if (fullResponse) {
            await prisma.message.create({
              data: {
                chatId: chat.id,
                content: fullResponse,
                role: 'ASSISTANT'
              }
            })

            // Update judul chat jika ini adalah pesan pertama
            if (previousMessages.length === 0) {
              await prisma.chat.update({
                where: { id: chat.id },
                data: {
                  title: userMessage.content.substring(0, 50)
                }
              })
            }
          }

          controller.close()
        } catch (error) {
          console.error('❌ Streaming error:', error)
          controller.error(error)
        }
      }
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
      },
    })

  } catch (error) {
    console.error('❌ Chat Error:', error)
    
    // Enhanced error handling
    let errorMessage = 'Internal Server Error'
    if (error instanceof Error) {
      if (error.message.includes('fetch failed') || error.message.includes('ENOTFOUND')) {
        errorMessage = `Cannot connect to Ollama at ${process.env.OLLAMA_HOST}`
      } else {
        errorMessage = error.message
      }
    }
    
    return NextResponse.json({
      error: errorMessage,
      ollamaHost: process.env.OLLAMA_HOST,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}