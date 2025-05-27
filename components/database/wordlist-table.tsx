// components/WordlistTable.tsx
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
import { wordlists } from "@/lib/security-resources"
import { useState } from "react"
import { TextFilePreview } from "@/components/database/text-file-preview"

interface WordlistTableProps {
  data: {
    id: string;
    name: string;
    type: string;
    size?: string;
    filePath?: string;
    sourceUrl?: string;
    previewAvailable: boolean;
  }[];
}


export const WordlistTable = ({ data }: WordlistTableProps) => {
  const [selectedResource, setSelectedResource] = useState<any>(null)

  return (
    <>
      <ScrollArea className="h-[400px] md:h-[500px] w-full">
        <div className="min-w-[600px] md:min-w-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[150px]">Type</TableHead>
    
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wordlists.map((wordlist) => (
                <TableRow key={wordlist.id}>
                  <TableCell>{wordlist.name}</TableCell>
                  <TableCell>
                    <Badge variant="default">{wordlist.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {wordlist.previewAvailable && wordlist.filePath && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedResource(wordlist)}
                        >
                          <FileText className="h-4 w-4 mr-2" /> Preview
                        </Button>
                      )}
                      {wordlist.filePath ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          asChild
                        >
                          <a 
                            href={wordlist.filePath} 
                            download 
                            target="_blank"
                            rel="noopener noreferrer"
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
                            href={wordlist.sourceUrl} 
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