// app/api/chat/history/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

// Extend the Session type to include user.id
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const chats = await prisma.chat.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1 // Ambil pesan pertama untuk preview
        }
      }
    })

    return NextResponse.json(chats)
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const newChat = await prisma.chat.create({
      data: {
        userId: session.user.id,
        title: 'New Chat',
        modelUsed: process.env.OLLAMA_MODEL || 'pentest-ai',
        messages: {
          create: {
            role: 'SYSTEM',
            content: 'Chat session started'
          }
        }
      }
    })

    return NextResponse.json(newChat)
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// app/api/chat/history/route.ts
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  const { searchParams } = new URL(req.url)
  const chatId = searchParams.get('id')
  
  if (!session?.user?.id || !chatId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Mulai transaction
    const deleteOperations = await prisma.$transaction([
      // Pertama hapus semua messages yang terkait dengan chat ini
      prisma.message.deleteMany({
        where: { 
          chatId: chatId
        }
      }),
      // Kemudian hapus chat-nya
      prisma.chat.delete({
        where: { 
          id: chatId,
          userId: session.user.id 
        }
      })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting chat:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}