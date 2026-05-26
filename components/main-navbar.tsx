"use client"

import { useState } from "react"
import { Shield, Settings, LogOut, User, Bell, Moon, HelpCircle, Boxes, Database, FileText, Menu, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Logo } from "./ui/logo"
import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"

export function MainNavbar() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

  const menuItems = [
    {
      id: "dashboard",
      label: "Tools",
      icon: Boxes,
      path: "/dashboard", 
    },
    { 
      id: "database", 
      label: "Database", 
      icon: Database,
      path: "/database",
    }
  ]

  return (
    <nav className="border-b border-gray-800 bg-[#151515] sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side: Logo & Navigation */}
          <div className="flex items-center gap-8">
            {/* Logo & Brand */}
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-md gradient-bg group-hover:opacity-90 transition-opacity">
                <Logo className="h-9 w-9 text-white" />
              </div>
              <div className="font-bold text-xl gradient-text ml-2">Pungoe Pentest</div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-2">
              {menuItems.map((item) => {
                const isActive = pathname === item.path
                return (
                  <Link
                    key={item.id}
                    href={item.path}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover-effect
                      ${isActive 
                        ? "bg-gray-800 text-white shadow-sm" 
                        : "text-gray-300 hover:bg-gray-800/50 hover:text-white"
                      }`}
                  >
                    <item.icon className={`h-4 w-4 ${isActive ? "text-gray-300" : "text-gray-400"}`} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right side: User Profile */}
          <div className="hidden md:flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-800 transition-colors focus:outline-none">
                  <Avatar className="h-9 w-9 border border-gray-600 cursor-pointer">
                    {"image" in (session?.user ?? {}) && (session?.user as any).image ? (
                      <AvatarImage src={(session?.user as any).image} alt="User" />
                    ) : (
                      <AvatarFallback className="bg-gray-800 text-gray-300 text-xs">
                        {getInitials(session?.user?.name)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-gray-900 border-gray-800 text-gray-200">             
                <div className="px-4 py-3 border-b border-gray-800">
                  <p className="text-sm font-medium text-white truncate">
                    {session?.user?.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-400 truncate mt-1">
                    {session?.user?.email || 'user@example.com'}
                  </p>
                </div>
                <DropdownMenuItem onClick={handleLogout} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer mt-1">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 focus:outline-none"
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#1a1a1a] border-b border-gray-800">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {menuItems.map((item) => {
              const isActive = pathname === item.path
              return (
                <Link
                  key={item.id}
                  href={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 block px-3 py-3 rounded-md text-base font-medium
                    ${isActive 
                      ? "bg-gray-800 text-white" 
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "text-gray-300" : "text-gray-400"}`} />
                  {item.label}
                </Link>
              )
            })}
          </div>
          <div className="pt-4 pb-3 border-t border-gray-800">
            <div className="flex items-center px-5">
              <div className="flex-shrink-0">
                <Avatar className="h-10 w-10 border border-gray-600">
                  {"image" in (session?.user ?? {}) && (session?.user as any).image ? (
                    <AvatarImage src={(session?.user as any).image} alt="User" />
                  ) : (
                    <AvatarFallback className="bg-gray-800 text-gray-300">
                      {getInitials(session?.user?.name)}
                    </AvatarFallback>
                  )}
                </Avatar>
              </div>
              <div className="ml-3">
                <div className="text-base font-medium text-white">{session?.user?.name || 'User'}</div>
                <div className="text-sm font-medium text-gray-400">{session?.user?.email || 'user@example.com'}</div>
              </div>
            </div>
            <div className="mt-3 px-2 space-y-1">
              <button
                onClick={handleLogout}
                className="flex items-center w-full gap-3 block px-3 py-2 rounded-md text-base font-medium text-red-400 hover:text-red-300 hover:bg-gray-800"
              >
                <LogOut className="h-5 w-5" />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
