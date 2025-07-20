"use client"

import { useState, useRef, useEffect, useCallback, memo, useMemo } from "react"
import { Send, Loader2, ChevronDown, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { ToolModal } from "@/components/tool-modal"
import { Message } from "@/app/types"
import { CodeBlock } from "@/components/code-block"
import { useToast } from "@/components/ui/use-toast"
import { Logo } from "@/components/ui/logo"
import 'prismjs/themes/prism-tomorrow.css' 
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"

interface ChatInterfaceProps {
  activeTool: string | null
}

export function ChatInterface({ activeTool }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isToolModalOpen, setIsToolModalOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const streamingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { toast } = useToast()
  const scrollLockRef = useRef(false)
  const lastMessageLengthRef = useRef(0)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  
  useEffect(() => {
    if (activeTool) {
      setIsToolModalOpen(true)
    }
  }, [activeTool])

  const handleCloseToolModal = () => {
    setIsToolModalOpen(false)
  }

  const processContent = useCallback((content: string) => {
    const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = []
    let buffer = ""
    let inCodeBlock = false
    let currentLanguage = "text"
    
    const lines = content.split('\n')
    
    for (const line of lines) {
      if (line.startsWith('```') && !inCodeBlock) {
        if (buffer) {
          parts.push({ type: 'text', content: buffer })
          buffer = ""
        }
        inCodeBlock = true
        currentLanguage = line.slice(3).trim() || "text"
        continue
      }
      
      if (line === '```' && inCodeBlock) {
        if (buffer) {
          parts.push({ type: 'code', content: buffer, language: currentLanguage })
          buffer = ""
        }
        inCodeBlock = false
        continue
      }
      
      buffer += line + '\n'
    }
    
    if (buffer) {
      parts.push({ 
        type: inCodeBlock ? 'code' : 'text', 
        content: buffer,
        ...(inCodeBlock ? { language: currentLanguage } : {})
      })
    }
    
    return parts
  }, [])

  useEffect(() => {
    const chatId = searchParams.get('chat')
    setCurrentChatId(chatId)

    const loadChat = async () => {
      if (!chatId) {
        setMessages([])
        return
      }

      try {
        const response = await fetch(`/api/chat/history/${chatId}`)
        if (!response.ok) throw new Error('Failed to load chat')
        
        const data = await response.json()
        const formattedMessages = data.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role.toLowerCase(),
          content: msg.content
        }))
        
        setMessages(formattedMessages)
      } catch (error) {
        console.error('Error loading chat:', error)
        setMessages([])
      }
    }

    loadChat()
  }, [searchParams])

  const MessageContent = memo(({ content }: { content: string }) => {
    const parts = useMemo(() => processContent(content), [content]);

    return (
      <div className="whitespace-pre-wrap">
        {parts.map((part, index) => {
          if (part.type === 'code') {
            return (
              <CodeBlock 
                key={`code-${index}-${hashCode(part.content)}`}
                code={part.content.trim()} 
                language={part.language ?? "text"} 
              />
            );
          }
          
          return (
            <span key={`text-${index}`} className="text-gray-200">
              {part.content}
            </span>
          );
        })}
      </div>
    );
  });

  function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  useEffect(() => {
    const container = chatContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const newIsAtBottom = scrollHeight - (scrollTop + clientHeight) < 50
      
      setIsAtBottom(newIsAtBottom)
      setShowScrollButton(!newIsAtBottom)
      
      if (!newIsAtBottom && scrollTop < lastMessageLengthRef.current) {
        scrollLockRef.current = true
      } else if (newIsAtBottom) {
        scrollLockRef.current = false
      }
      
      lastMessageLengthRef.current = scrollTop
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior })
    }, 100)
  }, [])

  useEffect(() => {
    if (isAtBottom && !scrollLockRef.current) {
      scrollToBottom('auto')
    }
  }, [messages, isAtBottom, scrollToBottom])

  const stopStreaming = () => {
    console.log('🛑 Stopping generation...')
    
    // Abort the current request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('User requested stop')
      abortControllerRef.current = null
    }
    
    // Update UI state
    streamingRef.current = false
    setIsLoading(false)
    
    toast({
      title: "Generation stopped",
      description: "Message generation was stopped successfully.",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || streamingRef.current) return

    setIsLoading(true)
    streamingRef.current = true
    
    // Create new abort controller
    abortControllerRef.current = new AbortController()
    
    const userMessage: Message = {
      role: "user",
      content: input,
      id: Date.now().toString()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput("")

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          messages: [userMessage],
          chatId: currentChatId
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        if (response.status === 499) {
          console.log('🛑 Request was aborted')
          return
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No reader available")

      let fullContent = ""
      const assistantMessageId = `assistant-${Date.now()}`
      
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "", 
        id: assistantMessageId 
      }])

      const decoder = new TextDecoder()
      
      console.log('🚀 Starting real-time streaming...')
      
      while (streamingRef.current && !abortControllerRef.current?.signal.aborted) {
        try {
          const { done, value } = await reader.read()
          if (done) {
            console.log('✅ Stream completed')
            break
          }

          const chunk = decoder.decode(value, { stream: true })
          fullContent += chunk
          
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: fullContent } 
              : msg
          ))
          
          if (isAtBottom && !scrollLockRef.current) {
            scrollToBottom('auto')
          }
          
        } catch (readError) {
          if (readError instanceof Error && readError.name === 'AbortError') {
            console.log('🛑 Stream aborted by user')
            break
          }
          throw readError
        }
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🛑 Request aborted')
      } else {
        console.error("❌ Chat Error:", error)
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          id: `error-${Date.now()}`
        }])
        toast({
          title: "Error",
          description: "Failed to send message. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      streamingRef.current = false
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleSendToolResults = async (content: string) => {
    setIsToolModalOpen(false);
    
    const toolMessage: Message = {
      role: "user",
      content: `Here are the results from the penetration testing tool. Please analyze these results and provide insights on potential vulnerabilities and next steps:\n\n${content}`,
      id: `tool-${Date.now()}`
    };

    setMessages(prev => [...prev, toolMessage]);
    
    setIsLoading(true);
    streamingRef.current = true;
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          messages: [toolMessage],
          chatId: currentChatId
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      let fullContent = "";
      const assistantMessageId = `assistant-${Date.now()}`;
      
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "", 
        id: assistantMessageId 
      }]);

      const decoder = new TextDecoder();
      
      while (streamingRef.current) {
        try {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: fullContent } 
              : msg
          ));
          
          if (isAtBottom && !scrollLockRef.current) {
            scrollToBottom('auto')
          }
        } catch (readError) {
          if (readError instanceof Error && readError.name === 'AbortError') {
            break
          }
          throw readError
        }
      }

      toast({
        title: "Tool results analyzed",
        description: "AI has completed analysis of the tool results.",
      });
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error("Error:", error);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Sorry, I encountered an error processing the tool results. Please try again.",
          id: `error-${Date.now()}`
        }]);
        toast({
          title: "Error",
          description: "Failed to process tool results",
          variant: "destructive",
        });
      }
    } finally {
      streamingRef.current = false;
      setIsLoading(false);
      abortControllerRef.current = null
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden h-full">
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-800 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-bg">
                <Logo className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-lg font-bold gradient-text">
                Hi, {session?.user?.name || 'User'} !
              </h2>
            </div>
          </div>

          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 relative scroll-smooth"
          >
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center max-w-md p-6 rounded-lg bg-gray-800/50 border border-gray-700">
                  <h3 className="text-xl font-bold mb-2 gradient-text">Welcome to Pungoe Pentest</h3>
                  <p className="text-gray-400">
                    Your AI-powered penetration testing assistant. Ask questions about security testing, vulnerability
                    assessment, or use the tools sidebar to access specialized functions.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <Card
                  key={message.id}
                  className={`p-4 ${
                    message.role === "user"
                      ? "ml-auto bg-gray-700/20 border-gray-700/30 max-w-[80%]"
                      : "bg-gray-900/50 border border-gray-800 max-w-[90%]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`rounded-full p-2 ${message.role === "user" ? "gradient-bg" : "bg-gray-800"}`}>
                      {message.role === "user" ? (
                        <div className="h-8 w-8 rounded-full bg-white" />
                      ) : (
                        <Logo className="h-7 w-7 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {message.role === "user" ? "You" : "PentestAI"}
                      </div>
                      <div className="mt-1 text-sm">
                        <MessageContent content={message.content} />
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
            <div ref={messagesEndRef} />
            
            {showScrollButton && (
              <button
                onClick={() => {
                  scrollToBottom('smooth')
                  setIsAtBottom(true)
                  scrollLockRef.current = false
                }}
                className="sticky bottom-4 left-1/2 transform -translate-x-1/2 p-2 rounded-full bg-gray-800 border border-gray-700 shadow-lg hover:bg-gray-700 transition-colors"
                aria-label="Scroll to bottom"
              >
                <ChevronDown className="h-5 w-5 text-gray-300" />
              </button>
            )}
          </div>

          <div className="border-t border-gray-800 p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about penetration testing techniques..."
                className="min-h-12 flex-1 resize-none bg-gray-800 border-gray-700 focus:border-gray-500"
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
              />
              <div className="flex gap-2">
                {isLoading && streamingRef.current ? (
                  <Button
                    type="button"
                    onClick={stopStreaming}
                    variant="outline"
                    className="border-red-500 text-red-500 hover:bg-red-500/10 hover:border-red-400"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="gradient-btn"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      <ToolModal 
        toolId={activeTool}
        isOpen={isToolModalOpen}
        onClose={handleCloseToolModal}
        onSendToChat={handleSendToolResults}
      />
    </div>
  )
}