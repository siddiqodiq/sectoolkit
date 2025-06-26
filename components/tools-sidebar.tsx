"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarMenuBadge,
  SidebarTrigger,
} from "@/components/ui/sidebar"
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
  DoorOpenIcon as DoorOpen,
  Antenna,
  Calculator,
  Pointer,
  Cctv
} from "lucide-react"
import { tools, getCategoryLabel } from "@/lib/tools"
import { useEffect } from "react"

interface ToolsSidebarProps {
  onSelectTool: (tool: string) => void
  activeTool: string | null
}

export function ToolsSidebar({ onSelectTool, activeTool }: ToolsSidebarProps) {
  useEffect(() => {
    const handleToggle = () => {
      document.dispatchEvent(new CustomEvent('toggle-right-sidebar'))
    }
    
    // Add event listener for keyboard shortcut
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 't' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleToggle()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])


  // Group tools by category
  const toolsByCategory = tools.reduce(
    (acc, tool) => {
      if (!acc[tool.category]) {
        acc[tool.category] = []
      }
      acc[tool.category].push(tool)
      return acc
    },
    {} as Record<string, typeof tools>,
  )

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
      "CVSS Scoring": Calculator,
      "DNS Recon": Cctv,
    }

    return iconMap[toolName] || Braces
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Available":
        return "text-green-500"
      case "Under Development":
        return "text-red-500"
      case "Maintenance":
        return "text-yellow-500"
      default:
        return "text-gray-500"
    }
  }

  return (
    <Sidebar side="right" variant="sidebar" collapsible="offcanvas" className="hidden sm:block">
      <SidebarHeader className="p-3">
        <div className="flex items-center justify-center">
          <div className="font-bold text-lg gradient-text">Pentest Tools</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {Object.entries(toolsByCategory).map(([category, categoryTools]) => (
          <SidebarGroup key={category}>
            <SidebarGroupLabel>{getCategoryLabel(category)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {categoryTools.map((tool) => {
                  const IconComponent = getToolIcon(tool.name)
                  return (
                    <SidebarMenuItem key={tool.id}>
                      <SidebarMenuButton
                        onClick={() => onSelectTool(tool.id)}
                        tooltip={tool.description}
                        className="hover-effect"
                      >
                        <IconComponent className="h-5 w-5" />
                        <span className="truncate">{tool.name}</span>
                      </SidebarMenuButton>
                      <SidebarMenuBadge>
                        <span className={`text-xs ${getStatusColor(tool.status)}`}>●</span>
                      </SidebarMenuBadge>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
      <SidebarTrigger className="absolute right-4 top-4 z-50 md:hidden hover-effect" />
    </Sidebar>
  )
}
