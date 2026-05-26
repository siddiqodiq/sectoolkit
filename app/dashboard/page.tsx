"use client"

import { useState, useEffect } from "react"
import { MainSidebar } from "@/components/main-sidebar"
import { ToolsSidebar } from "@/components/tools-sidebar"
import { ToolModal } from "@/components/tool-modal"
import { SidebarInset } from "@/components/ui/sidebar"
import { Menu, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ShieldAlert, Server, Boxes } from "lucide-react"

export default function Home() {
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [isToolModalOpen, setIsToolModalOpen] = useState(false)
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

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#212121]">
      <MainSidebar />
      <SidebarInset className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden relative p-8">
          
          {/* Mobile menu buttons */}
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

          <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto space-y-8 text-center">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight gradient-text sm:text-6xl">
                Pungoe Pentest Toolkit
              </h1>
              <p className="text-lg leading-8 text-gray-400 max-w-2xl mx-auto">
                Comprehensive security testing and vulnerability assessment tools.
                Use the tools sidebar to access specialized scanning functions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-8">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-200">
                    <ShieldAlert className="h-5 w-5 text-red-400" />
                    Vulnerability Scan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-400">
                    Scan web applications for common vulnerabilities like XSS, SQLi, and misconfigurations.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-200">
                    <Server className="h-5 w-5 text-blue-400" />
                    Infrastructure
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-400">
                    Analyze server configurations, open ports, and potential infrastructure weaknesses.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-200">
                    <Boxes className="h-5 w-5 text-green-400" />
                    Reconnaissance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-400">
                    Gather intelligence about target domains, subdomains, and exposed assets.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
          
          <ToolModal 
            toolId={activeTool}
            isOpen={isToolModalOpen}
            onClose={() => setIsToolModalOpen(false)}
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