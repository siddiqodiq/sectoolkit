import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { ChatOllama } from '@langchain/community/chat_models/ollama'
import { ConversationChain } from 'langchain/chains'
import { BufferMemory } from 'langchain/memory'
import { ChatMessageHistory } from 'langchain/stores/message/in_memory'
import { AIMessage, HumanMessage } from '@langchain/core/messages'
import { getKnowledgeBaseResponse } from './utils/chroma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const { messages, chatId, abortSignal, useKnowledgeBase = false } = await req.json()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
          take: 10
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

  if (!chat) {
    chat = await prisma.chat.create({
      data: {
        userId: session.user.id,
        title: messages.find((m: { role: string }) => m.role === 'user')?.content.substring(0, 50) || 'New Chat',
        modelUsed: process.env.OLLAMA_MODEL || 'pentest-ai'
      }
    })
  }

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

    // Handle Knowledge Base Request
    if (useKnowledgeBase) {
      console.log('🔍 Using Knowledge Base mode...')
      
      try {
        // getKnowledgeBaseResponse sekarang mengembalikan { response, sources }
        const knowledgeData = await getKnowledgeBaseResponse(
          userMessage.content,
          [], // chatHistory if needed
          session.user.id // Pass user ID for filtering
        )
        
        await prisma.message.create({
          data: {
            chatId: chat.id,
            content: knowledgeData.response,
            role: 'ASSISTANT',
            metadata: { sources: knowledgeData.sources }
          }
        })

        // SKIP saving sources to database for now
        // TODO: Add proper database structure later

        // Return JSON response with content and sources
        return NextResponse.json({
          content: knowledgeData.response,
          sources: knowledgeData.sources,
          chatId: chat.id
        })
      } catch (ragError) {
        console.error('❌ Knowledge base error:', ragError)
        console.log('🔄 Falling back to normal AI mode...')
        // Continue with normal processing if knowledge base fails
      }
    }

    // Prepare messages for Ollama (original logic)
    const ollamaMessages: { role: string; content: any }[] = []
    
    for (const msg of previousMessages) {
      ollamaMessages.push({
        role: msg.type === 'human' ? 'user' : 'assistant',
        content: msg.data.content
      })
    }
    
    ollamaMessages.push({
      role: 'user',
      content: userMessage.content
    })

    const encoder = new TextEncoder()
    let fullResponse = ''
    let isAborted = false
    
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Direct fetch to Ollama with abort signal
          const response = await fetch(`${process.env.OLLAMA_HOST}/api/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: process.env.OLLAMA_MODEL || 'pentest-ai',
              messages: ollamaMessages,
              stream: true,
              options: {
                temperature: 0.7
              }
            }),
            signal: req.signal // Use request abort signal directly
          })

          if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`)
          }

          const reader = response.body?.getReader()
          if (!reader) throw new Error('No reader available')

          while (true) {
            // Check abort signal
            if (req.signal?.aborted) {
              console.log('🛑 Request aborted, closing reader')
              reader.cancel()
              isAborted = true
              break
            }

            const { done, value } = await reader.read()
            if (done) break

            const chunk = new TextDecoder().decode(value)
            const lines = chunk.split('\n').filter(line => line.trim())

            for (const line of lines) {
              if (req.signal?.aborted) {
                isAborted = true
                break
              }

              try {
                const parsed = JSON.parse(line)
                if (parsed.message?.content) {
                  const content = parsed.message.content
                  fullResponse += content
                  controller.enqueue(encoder.encode(content))
                }
                
                if (parsed.done) {
                  console.log('✅ Ollama streaming completed')
                  break
                }
              } catch (parseError) {
                // Skip invalid JSON lines
                continue
              }
            }

            if (isAborted) break
          }

          // Save to database
          if (fullResponse) {
            const finalContent = isAborted ? fullResponse + ' [Generation stopped]' : fullResponse
            
            await prisma.message.create({
              data: {
                chatId: chat.id,
                content: finalContent,
                role: 'ASSISTANT'
              }
            })

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
          if (error instanceof Error && (error.name === 'AbortError' || req.signal?.aborted)) {
            console.log('🛑 Ollama request aborted')
            isAborted = true
            
            if (fullResponse) {
              await prisma.message.create({
                data: {
                  chatId: chat.id,
                  content: fullResponse + ' [Generation stopped]',
                  role: 'ASSISTANT'
                }
              })
            }
          } else {
            console.error('❌ Ollama streaming error:', error)
            controller.error(error)
          }
        }
      },
      
      cancel() {
        console.log('🛑 Stream cancelled by client')
      }
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
        'X-Chat-Id': chat.id,
      },
    })

  } catch (error) {
    console.error('❌ Chat Error:', error)
    
    let errorMessage = 'Internal Server Error'
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request was aborted'
      } else if (error.message.includes('fetch failed') || error.message.includes('ENOTFOUND')) {
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