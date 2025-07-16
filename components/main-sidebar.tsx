"use client"

import { useEffect, useState } from "react"
import { Shield, Database, Settings, LogOut, User, Bell, Moon, HelpCircle, Plus, MoreVertical, Loader2, Boxes } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Logo } from "./ui/logo"
import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { toast } from "./ui/use-toast"

export function MainSidebar() {
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false) 

  // Fungsi untuk mendapatkan active item berdasarkan pathname
  const getActiveItem = () => {
    if (pathname === "/dashboard") return "dashboard"
    if (pathname === "/tools") return "tools"
    if (pathname === "/database") return "database"
    return "dashboard" // default
  }

  // Refresh history ketika route berubah atau session berubah
  useEffect(() => {
    loadChatHistory()
  }, [session, pathname])

  // Fungsi untuk mendapatkan inisial dari nama
  const getInitials = (name?: string | null) => {
    if (!name) return 'US'
    const names = name.split(' ')
    let initials = names[0].substring(0, 1).toUpperCase()
    if (names.length > 1) {
      initials += names[names.length - 1].substring(0, 1).toUpperCase()
    }
    return initials
  }

  // Fungsi untuk handle logout
  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/')
  }

  useEffect(() => {
    const handleToggle = () => {
      document.dispatchEvent(new CustomEvent('toggle-left-sidebar'))
    }
    
    // Add event listener for keyboard shortcut
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleToggle()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const menuItems = [
    { 
      id: "dashboard", 
      label: "Dashboard AI", 
      icon: Shield,
      path: "/dashboard",
      onClick: () => router.push("/dashboard")
    },
    {
      id: "tools",
      label: "Tools",
      icon: Boxes,
      path: "/tools",
      onClick: () => router.push("/tools")
    },
    { 
      id: "database", 
      label: "Database", 
      icon: Database,
      path: "/database",
      onClick: () => router.push("/database")
    },
  ]

  const settingsItems = [
    { id: "help", label: "Help & Support", icon: HelpCircle },
  ]

  // Create new chat
  const handleNewChat = async () => {
    try {
      const response = await fetch('/api/chat/history', {
        method: 'POST'
      })
      const newChat = await response.json()
      router.push(`/dashboard?chat=${newChat.id}`)
      router.refresh()
    } catch (error) {
      console.error('Failed to create new chat:', error)
    }
  }

  // Delete chat
  const currentChatId = searchParams.get('chat')

  const loadChatHistory = async () => {
    if (!session?.user?.id) return
    
    setIsLoading(true) // Set loading true sebelum fetch
    try {
      const response = await fetch('/api/chat/history')
      const data = await response.json()
      setChatHistory(data)
    } catch (error) {
      console.error('Failed to load chat history:', error)
      toast({
        title: "Error",
        description: "Failed to load chat history",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false) // Set loading false setelah selesai
    }
  }

  // components/main-sidebar.tsx
  const handleDeleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chat/history?id=${chatId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete chat')
      }

      // Jika chat yang sedang aktif dihapus, redirect ke dashboard
      if (currentChatId === chatId) {
        router.push('/dashboard')
      }

      // Refresh chat history
      await loadChatHistory()

      toast({
        title: "Success",
        description: "Chat deleted successfully",
      })
    } catch (error) {
      console.error('Failed to delete chat:', error)
      toast({
        title: "Error",
        description: "Failed to delete chat",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    loadChatHistory()
  }, [session, pathname])

  return (
    <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md gradient-bg hover-pulse">
            <Logo className="h-9 w-9 text-white" />
          </div>
          <div className="font-bold text-lg gradient-text">Pungoe Pentest</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = pathname === item.path
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={item.onClick}
                      className={`hover-effect ${isActive ? "glow-border" : ""}`}
                    >
                      <item.icon className={`h-5 w-5 ${isActive ? "text-gray-400" : ""}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <div className="flex items-center justify-between px-4 py-2">
            <SidebarGroupLabel>Chat History</SidebarGroupLabel>
            <button 
              onClick={handleNewChat}
              className="p-1 rounded-full hover:bg-gray-700 transition-colors"
              aria-label="New chat"
              disabled={isLoading} // Disable saat loading
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
          </div>
          <SidebarGroupContent>
            {isLoading ? (
              <div className="flex justify-center items-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : (
              <SidebarMenu>
                {chatHistory.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <div className="flex items-center justify-between w-full group">
                      <SidebarMenuButton
                        onClick={() => router.push(`/dashboard?chat=${chat.id}`)}
                        className="flex-1 hover-effect"
                      >
                        <span className="truncate">
                          {chat.title || 'New Chat'}
                        </span>
                      </SidebarMenuButton>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button 
                            className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Chat options"
                            disabled={isLoading} // Disable saat loading
                          >
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => handleDeleteChat(chat.id)}
                            className="text-red-500 focus:text-red-500"
                            disabled={isLoading} // Disable saat loading
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-10 w-10 border-2 border-gray-500/30 cursor-pointer hover:border-gray-400 transition-colors">
                  {"image" in (session?.user ?? {}) && (session?.user as any).image ? (
                    <AvatarImage src={(session?.user as any).image} alt="User" />
                  ) : (
                    <AvatarFallback className="bg-gray-800 text-gray-300">
                      {getInitials(session?.user?.name)}
                    </AvatarFallback>
                  )}
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">             
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div>
              <p className="text-sm font-medium">
                {session?.user?.name || 'User'}
              </p>
              <p className="text-xs text-gray-400">
                @{session?.user?.email || session?.user?.name || 'user'}
              </p>
            </div>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
      <SidebarTrigger className="absolute left-4 top-4 z-50 md:hidden hover-effect" />
    </Sidebar>
  )
}
