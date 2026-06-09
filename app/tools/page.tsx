"use client"

import { useState, useEffect, useMemo } from "react"
import { MainNavbar } from "@/components/main-navbar"
import { ToolModal } from "@/components/tool-modal"
import { useSearchParams, useRouter } from 'next/navigation'
import { tools, getCategoryLabel } from "@/lib/tools"
import {
  Scan,
  FileSearch,
  Braces,
  Database,
  Globe,
  Search,
  Shield,
  AlertTriangle,
  Server,
  Code,
  Map,
  Pickaxe,
  Sword,
  FolderClock,
  DoorOpen,
  Antenna,
  Calculator,
  Pointer,
  Cctv,
  ArrowLeftRight,
  FolderTree,
  Heading
} from "lucide-react"

export default function Home() {
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [isToolModalOpen, setIsToolModalOpen] = useState(false)
  const [filter, setFilter] = useState<string>("all")
  const searchParams = useSearchParams()
  const router = useRouter()
  const toolFromUrl = searchParams.get('tool')

  // Handle tool selection from URL parameter
  useEffect(() => {
    if (toolFromUrl) {
      setActiveTool(toolFromUrl)
      setIsToolModalOpen(true)
      // Clean up URL parameter after setting the tool
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('tool')
      router.replace(newUrl.pathname + newUrl.search, { scroll: false })
    }
  }, [toolFromUrl, router])

  const handleToolSelect = (toolId: string) => {
    if (toolId === activeTool) {
      setIsToolModalOpen(false)
      setTimeout(() => setIsToolModalOpen(true), 10)
    } else {
      setActiveTool(toolId)
      setIsToolModalOpen(true)
    }
  }

  // Map tool names to icons
  const getToolIcon = (toolName: string) => {
    const iconMap: Record<string, any> = {
      "Whois Lookup": Search,
      "Google Dork": Pointer,
      "Subdomain Finder": Globe,
      "WAF Detector": Shield,
      "Port Scanner": Scan,
      "URL Crawler [FUZZ]": Pickaxe,
      "Deep URL Crawler": Sword,
      "Wayback Machine Dorking": FolderClock,
      "Web Parameter Enumerator": Map,
      "URL Fuzzer": FileSearch,
      "CORS Misc Scanner": Antenna,
      "Open Redirect Exploiter": DoorOpen,
      "Nuclei Scan": AlertTriangle,
      Nikto: Server,
      "XSS Exploiter": Code,
      "SQL Map": Database,
      "Decoder/Encoder": ArrowLeftRight,
      "JWT Debugger": Braces,
      "CVSS Scoring": Calculator,
      "DNS Recon": Cctv,
      "LFI Exploiter": FolderTree,
      "Subdomain Takeover": Braces,
      "Security Headers Checker": Heading,
    }

    return iconMap[toolName] || Braces
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Available":
        return "bg-green-500/20 text-green-400"
      case "Under Development":
        return "bg-yellow-500/20 text-yellow-400"
      case "Maintenance":
        return "bg-red-500/20 text-red-400"
      default:
        return "bg-gray-500/20 text-gray-400"
    }
  }

  // Filter tools by category
  const filteredTools = useMemo(() => {
    return filter === "all" 
      ? tools 
      : tools.filter(tool => tool.category === filter)
  }, [filter])

  // Group filtered tools by category - hanya untuk tampilan "all"
  const groupedTools = useMemo(() => {
    if (filter !== "all") {
      return {}
    }
    
    return tools.reduce((acc, tool) => {
      if (!acc[tool.category]) acc[tool.category] = []
      acc[tool.category].push(tool)
      return acc
    }, {} as Record<string, typeof tools>)
  }, [filter])

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      <MainNavbar />
      
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
          
          <div className="space-y-4 text-center py-8">
            <h1 className="text-4xl font-bold tracking-tight gradient-text sm:text-5xl">
              Pusdatin Security Toolkit
            </h1>
            <p className="text-lg leading-8 text-gray-400 max-w-2xl mx-auto">
              Comprehensive security testing and vulnerability assessment tools.
              Select a tool below to start scanning.
            </p>
          </div>

          <div className="flex flex-col h-full">
            {/* Filter buttons */}
            <div className="flex gap-2 pb-6 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
                  filter === "all" 
                    ? "bg-gray-700 text-white" 
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                All Tools 
              </button>
              {Array.from(new Set(tools.map(tool => tool.category))).map(category => {
                const categoryCount = tools.filter(tool => tool.category === category).length
                return (
                  <button
                    key={category}
                    onClick={() => setFilter(category)}
                    className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
                      filter === category 
                        ? "bg-gray-700 text-white" 
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {getCategoryLabel(category)}
                  </button>
                )
              })}
            </div>

            {/* Tools grid */}
            <div>
              {filter === "all" ? (
                // Tampilan berdasarkan kategori untuk "all"
                Object.entries(groupedTools).map(([category, categoryTools]) => (
                  <div key={category} className="mb-8">
                    <h2 className="text-xl font-bold mb-4 text-gray-200">
                      {getCategoryLabel(category)}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {categoryTools.map(tool => {
                        const IconComponent = getToolIcon(tool.name)
                        return (
                          <div
                            key={tool.id}
                            onClick={() => handleToolSelect(tool.id)}
                            className="bg-gray-800/40 hover:bg-gray-700/60 border border-gray-700/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 group"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="p-2.5 rounded-lg bg-gray-700/50 group-hover:bg-gray-600/50 transition-colors">
                                <IconComponent className="h-6 w-6 text-gray-300" />
                              </div>
                              <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${getStatusColor(tool.status)}`}>
                                {tool.status}
                              </span>
                            </div>
                            <h3 className="font-semibold text-gray-100 mb-2">
                              {tool.name}
                            </h3>
                            <p className="text-sm text-gray-400 line-clamp-2">
                              {tool.description}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              ) : (
                // Tampilan grid untuk kategori tertentu
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredTools.map(tool => {
                    const IconComponent = getToolIcon(tool.name)
                    return (
                      <div
                        key={tool.id}
                        onClick={() => handleToolSelect(tool.id)}
                        className="bg-gray-800/40 hover:bg-gray-700/60 border border-gray-700/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 group"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-2.5 rounded-lg bg-gray-700/50 group-hover:bg-gray-600/50 transition-colors">
                            <IconComponent className="h-6 w-6 text-gray-300" />
                          </div>
                          <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${getStatusColor(tool.status)}`}>
                            {tool.status}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-100 mb-2">
                          {tool.name}
                        </h3>
                        <p className="text-sm text-gray-400 line-clamp-2">
                          {tool.description}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          
          <ToolModal 
            toolId={activeTool}
            isOpen={isToolModalOpen}
            onClose={() => setIsToolModalOpen(false)}
          />
        </div>
      </div>
    </div>
  )
}