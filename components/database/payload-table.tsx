// components/PayloadTable.tsx
"use client"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Download, ExternalLink, FileText } from "lucide-react"
import { payloadTemplates } from "@/lib/security-resources"
import { useState } from "react"
import { TextFilePreview } from "@/components/database/text-file-preview"

interface PayloadTableProps {
  data: {
    id: string;
    name: string;
    type: string;
    size: string;
    filePath?: string;
    sourceUrl?: string;
    previewAvailable: boolean;
  }[];
}

export const PayloadTable = ({ data }: PayloadTableProps) => {
  const [selectedResource, setSelectedResource] = useState<any>(null)

  const downloadFile = async (filePath: string, fileName: string) => {
  try {
    // Hapus 'public/' dari path karena Next.js secara otomatis melayani dari public
    const relativePath = filePath.replace('public/', '')
    const response = await fetch(`/${relativePath}`)
    const blob = await response.blob()
    
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName.toLowerCase().replace(/\s+/g, '-') + '.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Download error:', error)
    alert('Failed to download file')
  }
}

  return (
    <>
      <ScrollArea className="h-[400px] md:h-[500px] w-full">
        <div className="min-w-[600px] md:min-w-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[150px]">Type</TableHead>
                <TableHead className="w-[80px]">Size</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payloadTemplates.map((payload) => (
                <TableRow key={payload.id}>
                  <TableCell>{payload.name}</TableCell>
                  <TableCell>
                    <Badge variant="default">{payload.type}</Badge>
                  </TableCell>
                  <TableCell>{payload.size}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {payload.previewAvailable && payload.filePath && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedResource(payload)}
                        >
                          <FileText className="h-4 w-4 mr-2" /> Preview
                        </Button>
                      )}
                      {payload.filePath ? (
                        <Button 
                        variant="outline" 
                        size="sm"
                        asChild
                      >
                        <a 
                          href={payload.filePath.replace('public/', '/')} 
                          download={`${payload.name.toLowerCase().replace(/\s+/g, '-')}.txt`}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          asChild
                        >
                          <a 
                            href={payload.sourceUrl} 
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>

      {selectedResource && (
        <TextFilePreview
          resource={selectedResource}
          open={!!selectedResource}
          onOpenChange={(open) => !open && setSelectedResource(null)}
        />
      )}
    </>
  )
}