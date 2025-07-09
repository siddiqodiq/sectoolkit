import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { ChatOllama } from '@langchain/community/chat_models/ollama'
import { ConversationChain } from 'langchain/chains'
import { BufferMemory } from 'langchain/memory'
import { ChatMessageHistory } from 'langchain/stores/message/in_memory'
import { AIMessage, HumanMessage } from '@langchain/core/messages'
import { streamText } from 'ai'
import { ollama} from 'ollama-ai-provider'

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
    // Inisialisasi model Ollama
    const model = ollama(process.env.OLLAMA_MODEL || 'pentest-ai')

    // Buat memory dari riwayat percakapan
    const messageHistory = new ChatMessageHistory()
    
    // Tambahkan pesan sebelumnya ke memory
    for (const msg of previousMessages) {
      if (msg.type === 'human') {
        await messageHistory.addMessage(new HumanMessage(msg.data.content))
      } else {
        await messageHistory.addMessage(new AIMessage(msg.data.content))
      }
    }

    // Tambahkan pesan baru ke memory
    await messageHistory.addMessage(new HumanMessage(userMessage.content))

    // Buat memory buffer
    const memory = new BufferMemory({
      chatHistory: messageHistory,
      returnMessages: true,
      memoryKey: "history"
    })

    // Buat conversation chain
    const chain = new ConversationChain({
      llm: new ChatOllama({
        baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'pentest-ai',
      }),
      memory: memory
    })

    // Gabungkan pesan untuk dikirim ke model
    const allMessages = [
      ...(await memory.chatHistory.getMessages()),
      new HumanMessage(userMessage.content)
    ]

    // Gunakan streamText dari ai package
    const { textStream } = await streamText({
      model,
      messages: allMessages.map(msg => ({
        role: msg._getType() === 'human' ? 'user' : 'assistant',
        content: typeof msg.content === 'string' ? msg.content : String(msg.content)
      })),
    })

    let fullResponse = ''
    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        for await (const chunk of textStream) {
          fullResponse += chunk
          controller.enqueue(encoder.encode(chunk))
        }

        // Simpan response AI ke database setelah stream selesai
        await prisma.message.create({
          data: {
            chatId: chat.id,
            content: fullResponse,
            role: 'ASSISTANT'
          }
        })

        // Update judul chat jika ini adalah pesan pertama
        if (messages.length <= 2) {
          await prisma.chat.update({
            where: { id: chat.id },
            data: {
              title: userMessage.content.substring(0, 50)
            }
          })
        }

        controller.close()
      }
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}