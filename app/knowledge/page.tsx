// app/knowledge/page.tsx - Update layout sesuai tools page
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import { Upload, Trash2, FileText, Brain, Plus, Eye, Zap, RefreshCw, CheckCircle, Menu } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MainSidebar } from "@/components/main-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"

interface KnowledgeFile {
  id: string
  name: string
  size: number
  type: 'user'
  uploadedAt: string
  status: 'active' | 'processing' | 'error' | 'ingested'
  chunks?: number
  ingested?: boolean
}

export default function KnowledgeBasePage() {
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false) // <-- TAMBAHKAN STATE INI
  const [isIngesting, setIsIngesting] = useState(false)
  const [ingestProgress, setIngestProgress] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewFile, setPreviewFile] = useState<KnowledgeFile | null>(null)
  const [fileContent, setFileContent] = useState<string>("")
  const [ingestStatus, setIngestStatus] = useState<string>("")
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadKnowledgeFiles()
  }, [])

  const loadKnowledgeFiles = async () => {
    try {
      const response = await fetch('/api/knowledge/files')
      const data = await response.json()
      const userFiles = (data.files || []).filter((f: KnowledgeFile) => f.type === 'user')
      setFiles(userFiles)
    } catch (error) {
      console.error('Failed to load knowledge files:', error)
      toast({
        title: "Error",
        description: "Failed to load knowledge base files",
        variant: "destructive",
      })
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // FIX: Validate by extension as well, as MIME type can be unreliable for .md
      const allowedMimeTypes = ['text/plain', 'application/pdf', 'text/markdown'];
      const allowedExtensions = ['.txt', '.pdf', '.md'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

      if (!allowedMimeTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        toast({
          title: "Invalid file type",
          description: "Only .txt, .pdf, and .md files are supported",
          variant: "destructive",
        })
        return
      }
      
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 10MB",
          variant: "destructive",
        })
        return
      }
      
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsLoading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result = await response.json()
      toast({
        title: "Upload successful",
        description: `${result.name} has been uploaded.`,
      })
      setSelectedFile(null)

    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setUploadProgress(0)
      // --- TAMBAHKAN BARIS INI UNTUK MEMUAT ULANG DAFTAR FILE ---
      loadKnowledgeFiles() 
      // ---------------------------------------------------------
    }
  }


  const handleDelete = async (fileId: string, fileName: string) => {

    try {
      const response = await fetch(`/api/knowledge/files/${fileId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Delete failed')
      }

      toast({
        title: "File deleted",
        description: `${fileName} has been removed from knowledge base`,
      })

      loadKnowledgeFiles()
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: "Delete failed",
        description: "Failed to delete file from knowledge base",
        variant: "destructive",
      })
    }
  }

  const handlePreview = async (file: KnowledgeFile) => {
    try {
      const response = await fetch(`/api/knowledge/files/${file.id}/content`)
      const content = await response.text()
      setFileContent(content)
      setPreviewFile(file)
    } catch (error) {
      toast({
        title: "Preview failed",
        description: "Failed to load file content",
        variant: "destructive",
      })
    }
  }

  const handleIngestToDatabase = async () => {
    const readyFiles = files.filter(f => f.status === 'active' && !f.ingested)
    
    if (readyFiles.length === 0) {
      toast({
        title: "No files to ingest",
        description: "Upload and activate files first before ingesting",
        variant: "destructive",
      })
      return
    }

    setIsIngesting(true)
    setIngestProgress(0)
    setIngestStatus("Preparing files for ingestion...")

    try {
      const response = await fetch('/api/knowledge/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileIds: readyFiles.map(f => f.id)
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Ingestion failed')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream available')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line)
              
              if (data.progress !== undefined) {
                setIngestProgress(data.progress)
              }
              
              if (data.status) {
                setIngestStatus(data.status)
              }
              
              if (data.complete) {
                toast({
                  title: "Ingestion complete",
                  description: `${readyFiles.length} files have been ingested into knowledge base`,
                })
                loadKnowledgeFiles()
                break
              }
            } catch (parseError) {
              console.error('Failed to parse progress:', parseError)
            }
          }
        }
      }
    } catch (error) {
      console.error('Ingestion error:', error)
      toast({
        title: "Ingestion failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsIngesting(false)
      setIngestProgress(0)
      setIngestStatus("")
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400'
      case 'processing': return 'bg-yellow-500/20 text-yellow-400'
      case 'error': return 'bg-red-500/20 text-red-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  const readyToIngestFiles = files.filter(f => f.status === 'active' && !f.ingested)
  const ingestedFiles = files.filter(f => f.ingested)

  return (
    // ✅ Update layout structure to match tools page
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
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold gradient-text">Knowledge Base Management</h1>
                  <p className="text-gray-400 mt-1">
                    Upload, ingest, and manage your knowledge base files
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {/* Ingest Button */}
                  <Button
                    onClick={handleIngestToDatabase}
                    disabled={isIngesting || readyToIngestFiles.length === 0}
                    className="gradient-btn flex items-center gap-2"
                  >
                    {isIngesting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Ingesting...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Ingest to DB ({readyToIngestFiles.length})
                      </>
                    )}
                  </Button>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Brain className="h-4 w-4" />
                    <span>{files.length} files total</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content area with proper overflow */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                {/* Ingestion Progress */}
                {isIngesting && (
                  <Card className="mb-6 border-blue-500/20 bg-blue-500/5">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                          <span className="font-medium">Ingesting Knowledge Base</span>
                        </div>
                        <Progress value={ingestProgress} className="w-full" />
                        <p className="text-sm text-gray-400">{ingestStatus}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Status Alert */}
                {ingestedFiles.length > 0 && (
                  <Alert className="mb-6 border-green-500/20 bg-green-500/5">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-300">
                      {ingestedFiles.length} files have been ingested and are available for knowledge base queries.
                    </AlertDescription>
                  </Alert>
                )}

                {/* ✅ Tabs with consistent styling */}
                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-gray-800/50">
                    <TabsTrigger 
                      value="upload" 
                      className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Files
                    </TabsTrigger>
                    <TabsTrigger 
                      value="manage" 
                      className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
                    >
                      <FileText className="h-4 w-4" />
                      My Files ({files.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* Upload Tab */}
                  <TabsContent value="upload" className="mt-6">
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-gray-200">
                          <Plus className="h-5 w-5" />
                          Add New Knowledge
                        </CardTitle>
                        <CardDescription className="text-gray-400">
                          Upload documents to enhance AI responses with domain-specific knowledge
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="file-upload" className="text-gray-300">Select File</Label>
                            <Input
                              id="file-upload"
                              type="file"
                              accept=".txt,.pdf,.md"
                              onChange={handleFileSelect}
                              className="mt-1 bg-gray-700/50 border-gray-600 text-gray-200"
                            />
                            <p className="text-xs text-gray-400 mt-1">
                              Supported formats: .txt, .pdf, .md (max 10MB)
                            </p>
                          </div>

                          {selectedFile && (
                            <Card className="p-4 bg-gray-700/50 border-gray-600">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <FileText className="h-8 w-8 text-blue-400" />
                                  <div>
                                    <p className="font-medium text-gray-200">{selectedFile.name}</p>
                                    <p className="text-sm text-gray-400">
                                      {formatFileSize(selectedFile.size)}
                                    </p>
                                  </div>
                                </div>
                                <Button 
                                  onClick={handleUpload}
                                  disabled={isLoading}
                                  className="gradient-btn"
                                >
                                  {isLoading ? 'Uploading...' : 'Upload'}
                                </Button>
                              </div>
                              {isLoading && (
                                <Progress value={uploadProgress} className="mt-3" />
                              )}
                            </Card>
                          )}
                        </div>

                        <div className="p-4 border border-dashed border-gray-600 rounded-lg text-center">
                          <Brain className="h-12 w-12 text-gray-500 mx-auto mb-3" />
                          <h3 className="font-medium mb-2 text-gray-200">How it works</h3>
                          <p className="text-sm text-gray-400 mb-4">
                            Your uploaded documents will be processed and indexed for semantic search.
                            The AI will use this knowledge to provide more accurate and contextual responses.
                          </p>
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-1">
                                <Upload className="h-4 w-4 text-blue-400" />
                              </div>
                              <p className="text-gray-400">Upload</p>
                            </div>
                            <div>
                              <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-1">
                                <Brain className="h-4 w-4 text-yellow-400" />
                              </div>
                              <p className="text-gray-400">Process</p>
                            </div>
                            <div>
                              <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-1">
                                <Zap className="h-4 w-4 text-green-400" />
                              </div>
                              <p className="text-gray-400">Ingest</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Manage Files Tab */}
                  <TabsContent value="manage" className="mt-6">
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-gray-200">
                          <FileText className="h-5 w-5" />
                          My Knowledge Files
                        </CardTitle>
                        <CardDescription className="text-gray-400">
                          Your uploaded knowledge base files. Click "Ingest to DB" to make them available for AI queries.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4">
                          {files.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                              <p>No files uploaded yet</p>
                              <p className="text-sm">Upload your first file to get started</p>
                            </div>
                          ) : (
                            files.map((file) => (
                              <div key={file.id} className="flex items-center justify-between p-4 border border-gray-700 rounded-lg hover:bg-gray-700/30 transition-colors">
                                <div className="flex items-center gap-3">
                                  <FileText className={`h-8 w-8 ${file.ingested ? 'text-green-400' : 'text-blue-400'}`} />
                                  <div>
                                    <p className="font-medium text-gray-200">{file.name}</p>
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                      <span>{formatFileSize(file.size)}</span>
                                      <span>•</span>
                                      <span>Uploaded {new Date(file.uploadedAt).toLocaleDateString()}</span>
                                      <Badge className={getStatusColor(file.status)}>
                                        {file.status}
                                      </Badge>
                                      {file.ingested && (
                                        <Badge className="bg-green-500/20 text-green-400">
                                          Ingested
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePreview(file)}
                                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setConfirmDelete({ id: file.id, name: file.name })}
                                    className="border-gray-600 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Confirmation Dialog */}
                    <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
                      <DialogContent className="max-w-md bg-gray-800 border-gray-700">
                        <DialogHeader>
                          <DialogTitle className="text-red-400 flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            Confirm Delete
                          </DialogTitle>
                          <DialogDescription className="text-gray-400">
                            Are you sure you want to delete <span className="font-semibold text-gray-200">{confirmDelete?.name}</span>? This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex justify-end gap-2 mt-4">
                          <Button
                            variant="outline"
                            onClick={() => setConfirmDelete(null)}
                            disabled={isDeleting}
                            className="border-gray-600 text-gray-300"
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            disabled={isDeleting}
                            onClick={async () => {
                              if (confirmDelete) {
                                setIsDeleting(true);
                                await handleDelete(confirmDelete.id, confirmDelete.name)
                                setIsDeleting(false);
                                setConfirmDelete(null)
                              }
                            }}
                            className="bg-red-600 text-white hover:bg-red-700 w-28"
                          >
                            {isDeleting ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              'Delete'
                            )}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-200">
              <FileText className="h-5 w-5" />
              {previewFile?.name}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              File preview - {previewFile && formatFileSize(previewFile.size)}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] w-full rounded border border-gray-600 p-4 bg-gray-900/50">
            <pre className="whitespace-pre-wrap text-sm text-gray-300">{fileContent}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}