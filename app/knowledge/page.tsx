// app/knowledge/page.tsx - Update dengan tombol ingest
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
import { ArrowLeft, Upload, Trash2, FileText, Database, Brain, Plus, Eye, Download, Zap, RefreshCw, CheckCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface KnowledgeFile {
  id: string
  name: string
  size: number
  type: 'application' | 'user'
  uploadedAt: string
  status: 'active' | 'processing' | 'error' | 'ingested'
  chunks?: number
  ingested?: boolean
}

export default function KnowledgeBasePage() {
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isIngesting, setIsIngesting] = useState(false)
  const [ingestProgress, setIngestProgress] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewFile, setPreviewFile] = useState<KnowledgeFile | null>(null)
  const [fileContent, setFileContent] = useState<string>("")
  const [ingestStatus, setIngestStatus] = useState<string>("")
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    loadKnowledgeFiles()
  }, [])

  const loadKnowledgeFiles = async () => {
    try {
      const response = await fetch('/api/knowledge/files')
      const data = await response.json()
      setFiles(data.files || [])
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
      // Validate file type
      const allowedTypes = ['text/plain', 'application/pdf', 'text/markdown']
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Only .txt, .pdf, and .md files are supported",
          variant: "destructive",
        })
        return
      }
      
      // Validate file size (max 10MB)
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
        throw new Error('Upload failed')
      }

      const data = await response.json()
      
      toast({
        title: "Upload successful",
        description: `${selectedFile.name} has been added to knowledge base`,
      })

      setSelectedFile(null)
      loadKnowledgeFiles()
      
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''

    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: "Upload failed",
        description: "Failed to upload file to knowledge base",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setUploadProgress(0)
    }
  }

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return

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
    // Filter files yang siap untuk di-ingest (status active dan belum di-ingest)
    const readyFiles = files.filter(f => f.type === 'user' && f.status === 'active' && !f.ingested)
    
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

      // Stream the ingestion progress
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
                loadKnowledgeFiles() // Reload files to update status
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

  const applicationFiles = files.filter(f => f.type === 'application')
  const userFiles = files.filter(f => f.type === 'user')
  const readyToIngestFiles = userFiles.filter(f => f.status === 'active' && !f.ingested)
  const ingestedFiles = userFiles.filter(f => f.ingested)

  return (
    <div className="min-h-screen p-4 md:p-8 bg-background">
      <div className="max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold gradient-text">Knowledge Base Management</h1>
              <p className="text-muted-foreground mt-1">
                Upload, ingest, and manage your knowledge base files
              </p>
            </div>
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4" />
              <span>{files.length} files total</span>
            </div>
          </div>
        </div>

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
                <p className="text-sm text-muted-foreground">{ingestStatus}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Alert */}
        {ingestedFiles.length > 0 && (
          <Alert className="mb-6 border-green-500/20 bg-green-500/5">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700">
              {ingestedFiles.length} files have been ingested and are available for knowledge base queries.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Files
            </TabsTrigger>
            <TabsTrigger value="application" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Application KB ({applicationFiles.length})
            </TabsTrigger>
            <TabsTrigger value="user" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              My Files ({userFiles.length})
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="mt-6">
            <Card className="glass-effect">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add New Knowledge
                </CardTitle>
                <CardDescription>
                  Upload documents to enhance AI responses with domain-specific knowledge
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="file-upload">Select File</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".txt,.pdf,.md"
                      onChange={handleFileSelect}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Supported formats: .txt, .pdf, .md (max 10MB)
                    </p>
                  </div>

                  {selectedFile && (
                    <Card className="p-4 bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-blue-500" />
                          <div>
                            <p className="font-medium">{selectedFile.name}</p>
                            <p className="text-sm text-muted-foreground">
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

                <div className="p-4 border border-dashed border-muted-foreground/25 rounded-lg text-center">
                  <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-medium mb-2">How it works</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your uploaded documents will be processed and indexed for semantic search.
                    The AI will use this knowledge to provide more accurate and contextual responses.
                  </p>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-1">
                        <Upload className="h-4 w-4 text-blue-400" />
                      </div>
                      <p>Upload</p>
                    </div>
                    <div>
                      <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-1">
                        <Brain className="h-4 w-4 text-yellow-400" />
                      </div>
                      <p>Process</p>
                    </div>
                    <div>
                      <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-1">
                        <Database className="h-4 w-4 text-green-400" />
                      </div>
                      <p>Index</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Application Knowledge Base Tab */}
          <TabsContent value="application" className="mt-6">
            <Card className="glass-effect">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Application Knowledge Base
                </CardTitle>
                <CardDescription>
                  Pre-built knowledge base for penetration testing and cybersecurity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {applicationFiles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No application knowledge base files found</p>
                    </div>
                  ) : (
                    applicationFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-blue-500" />
                          <div>
                            <p className="font-medium">{file.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{formatFileSize(file.size)}</span>
                              <span>•</span>
                              <span>{file.chunks} chunks</span>
                              <Badge className={getStatusColor(file.status)}>
                                {file.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreview(file)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Files Tab */}
          <TabsContent value="user" className="mt-6">
            <Card className="glass-effect">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  My Knowledge Files
                </CardTitle>
                <CardDescription>
                  Your uploaded knowledge base files. Click "Ingest to DB" to make them available for AI queries.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {userFiles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No user files uploaded yet</p>
                      <p className="text-sm">Upload your first file to get started</p>
                    </div>
                  ) : (
                    userFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <FileText className={`h-8 w-8 ${file.ingested ? 'text-green-500' : 'text-blue-500'}`} />
                          <div>
                            <p className="font-medium">{file.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(file.id, file.name)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )))
                  }
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {previewFile?.name}
            </DialogTitle>
            <DialogDescription>
              File preview - {previewFile && formatFileSize(previewFile.size)}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] w-full rounded border p-4">
            <pre className="whitespace-pre-wrap text-sm">{fileContent}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}