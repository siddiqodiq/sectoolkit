// app/api/chat/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { ollama, createOllama } from 'ollama-ai-provider'
import { streamText } from 'ai'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const { messages, chatId } = await req.json()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Pastikan chatId valid
  let chat = null
  if (chatId) {
    chat = await prisma.chat.findUnique({
      where: {
        id: chatId,
        userId: session.user.id
      }
    })
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

  const model = createOllama({
  model: process.env.OLLAMA_MODEL || 'pentest-ai',
  baseURL: 'http://host.docker.internal:11434' // 👈 Kunci perubahan
})

  try {
    const { textStream } = await streamText({
      model,
      messages,
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
        if (messages.length <= 2) { // System message + 1 user message
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