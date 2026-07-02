// components/tools/base-tool-modal.tsx
import { Modal } from "@/components/ui/modal"
import { Tool } from "@/lib/tools"
import { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface BaseToolModalProps {
  tool: Tool
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}

export function BaseToolModal({ 
  tool, 
  isOpen, 
  onClose, 
  children,
  className = "" 
}: BaseToolModalProps) {
  if (!isOpen || !tool) return null

  return (
    <Modal open={isOpen} onClose={onClose} closeOnOutsideClick={false}>
      <div className={`flex flex-col max-h-[80vh] w-full ${className}`}>
        <div className="border-b border-gray-800 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div>
            <h2 className="text-xl font-bold gradient-text">{tool.name}</h2>
            <p className="text-sm text-gray-400 mt-1 line-clamp-2 sm:line-clamp-none">{tool.description}</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <Badge className={getStatusColor(tool.status)}>
              {tool.status}
            </Badge>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={onClose}
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {children}
      </div>
    </Modal>
  )
}

// Helper function dengan type yang lebih spesifik
function getStatusColor(status: "Available" | "Under Development" | "Maintenance" | string): string {
  switch (status) {
    case "Available":
      return "bg-green-500/20 text-green-500 border-green-500/50"
    case "Under Development":
      return "bg-yellow-500/20 text-yellow-500 border-yellow-500/50"
    case "Maintenance":
      return "bg-red-500/20 text-red-500 border-red-500/50"
    default:
      return "bg-gray-500/20 text-gray-500 border-gray-500/50"
  }
}