// app/tools/page.tsx
"use client"

import { useState } from "react"
import { tools, getCategoryLabel } from "@/lib/tools"
import { ToolModal } from "@/components/tool-modal"
import { MainSidebar } from "@/components/main-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/use-toast"


export default function ToolsPage() {
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>("all")
 const router = useRouter()

 // Handle ketika tool dipilih
  const handleToolSelect = (toolId: string) => {
    router.push(`/dashboard?tool=${toolId}`)
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
  const filteredTools = filter === "all" 
    ? tools 
    : tools.filter(tool => tool.category === filter)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#212121]">
      <MainSidebar />
      <SidebarInset className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden relative">
          {/* Mobile menu button */}
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

          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="border-b border-gray-800 p-4">
              <h1 className="text-2xl font-bold gradient-text">Penetration Testing Tools</h1>
              <p className="text-gray-400 mt-1">Select a tool to get started with your security assessment</p>
            </div>

            {/* Filter buttons */}
            <div className="flex gap-2 p-4 overflow-x-auto scrollbar-hide">
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
              {Array.from(new Set(tools.map(tool => tool.category))).map(category => (
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
              ))}
            </div>

            {/* Tools grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {Object.entries(
                tools.reduce((acc, tool) => {
                  if (!acc[tool.category]) acc[tool.category] = []
                  if (filter === "all" || tool.category === filter) {
                    acc[tool.category].push(tool)
                  }
                  return acc
                }, {} as Record<string, typeof tools>)
              ).map(([category, categoryTools]) => (
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
                          className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg hover:scale-105 group"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 rounded-md bg-gray-700/50 group-hover:bg-gray-600/50 transition-colors">
                              <IconComponent className="h-6 w-6 text-gray-300" />
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(tool.status)}`}>
                              {tool.status}
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-200 mb-2">
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
              ))}
            </div>
          </div>
        </div>
      </SidebarInset>
    </div>
  )
}