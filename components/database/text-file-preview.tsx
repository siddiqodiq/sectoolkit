// components/TextFilePreview.tsx
"use client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Download, ExternalLink, WrapText, X } from "lucide-react"
import { useState, useEffect } from "react"

export const TextFilePreview = ({
  resource,
  open,
  onOpenChange
}: {
  resource: any
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const [fileContent, setFileContent] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [wrapText, setWrapText] = useState(true)

  useEffect(() => {
    if (open && resource?.filePath) {
      fetchFileContent()
    }
  }, [open, resource])

  const fetchFileContent = async () => {
  try {
    setLoading(true)
    const filePath = resource.filePath.replace(/^public\//, '')
    const url = `${window.location.origin}/${filePath}`
    console.log('Fetching:', url)

    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    const text = await response.text()
    setFileContent(text)
  } catch (error) {
    console.error("Error loading file:", error)
    setFileContent("Failed to load file content")
  } finally {
    setLoading(false)
  }
}


  const handleDownload = () => {
    if (resource.filePath) {
      const link = document.createElement('a')
      const filePath = resource.filePath.replace('public/', '/')
      link.href = filePath
      link.download = `${resource.name.replace(/\s+/g, '-').toLowerCase()}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col [&>button]:hidden">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <DialogTitle className="flex-1 truncate pr-4">{resource.name}</DialogTitle>
          <div className="flex items-center gap-2">
            {resource.filePath && (
              <Button variant="outline" size="sm" onClick={handleDownload} className="h-8">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
            
            {resource.sourceUrl && (
              <Button variant="outline" size="sm" asChild className="h-8">
                <a href={resource.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Source
                </a>
              </Button>
            )}

            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onOpenChange(false)} 
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 rounded-md border">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="h-full max-h-[70vh] overflow-auto">
              <pre className={`p-4 text-sm bg-gray-900 text-gray-100 ${wrapText ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
                {fileContent || "No content available for preview"}
              </pre>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}