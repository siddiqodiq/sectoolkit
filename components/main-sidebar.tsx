"use client"

import { useEffect, useState } from "react"
import { Shield, Settings, LogOut, User, Bell, Moon, HelpCircle, Boxes, Database } from "lucide-react"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Logo } from "./ui/logo"
import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

export function MainSidebar() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()

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
      label: "Dashboard", 
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
    }
  ]

  return (
    <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md gradient-bg hover-pulse">
            <Logo className="h-9 w-9 text-white" />
          </div>
          <div className="font-bold text-lg gradient-text">Pusdatin Security Toolkit</div>
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
                {session?.user?.email || session?.user?.name || 'user'}
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
