"use client"

import { useState, useEffect } from "react"
import { MainSidebar } from "@/components/main-sidebar"
import { ChatInterface } from "@/components/chat-interface"
import { ToolsSidebar } from "@/components/tools-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { Menu, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { Loader2 } from "lucide-react"

export default function Home() {
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const chatId = searchParams.get('chat')

  const handleToolSelect = (toolId: string) => {
    if (toolId === activeTool) {
      setActiveTool(null)
      setTimeout(() => setActiveTool(toolId), 10)
    } else {
      setActiveTool(toolId)
    }
  }

  useEffect(() => {
    const loadChat = async () => {
      if (chatId) {
        try {
          setIsLoading(true)
          const response = await fetch(`/api/chat/history/${chatId}`)
          const data = await response.json()
          // Set messages sesuai data dari database
        } catch (error) {
          console.error('Failed to load chat:', error)
        } finally {
          setIsLoading(false)
        }
      }
    }

    loadChat()
  }, [chatId])

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#212121]">
      <MainSidebar />
      <SidebarInset className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden relative">
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          )}

          {/* Mobile menu buttons - only visible on small screens */}
          <div className="md:hidden fixed top-4 left-4 z-40">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full bg-gray-800/80 backdrop-blur-sm border-gray-700 hover:bg-gray-700"
              onClick={() => document.dispatchEvent(new CustomEvent('toggle-left-sidebar'))}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </div>

          <div className="md:hidden fixed top-4 right-4 z-40">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full bg-gray-800/80 backdrop-blur-sm border-gray-700 hover:bg-gray-700"
              onClick={() => document.dispatchEvent(new CustomEvent('toggle-right-sidebar'))}
            >
              <Wrench className="h-5 w-5" />
              <span className="sr-only">Toggle Tools</span>
            </Button>
          </div>

          <ChatInterface 
            activeTool={activeTool} 
          />
        </div>
      </SidebarInset>
      <ToolsSidebar 
        onSelectTool={handleToolSelect} 
        activeTool={activeTool} 
      />
    </div>
  )
}