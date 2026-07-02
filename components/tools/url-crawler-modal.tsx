// components/tools/url-crawler-modal.tsx
"use client";
import { useState, useRef, ChangeEvent, useEffect } from "react";
import { BaseToolModal } from "./base-tool-modal";
import { Tool } from "@/lib/tools";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent} from "@/components/ui/tabs";
import { 
  Loader2, 
  Play, 
  Copy, 
  Download, 
  Check, 
  Send,
  FileInput,
  Upload,
  X,
  Info,
  ChevronDown
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";


interface UrlCrawlerModalProps {
    tool: Tool;
    isOpen: boolean;
    onClose: () => void;
    onSendToChat?: (content: string) => void;
  }

export function UrlCrawlerModal({ tool, isOpen, onClose, onSendToChat }: UrlCrawlerModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [domain, setDomain] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<"single" | "batch">("single");
    const [showConfirmClose, setShowConfirmClose] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showFormatGuide, setShowFormatGuide] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const { toast } = useToast();
  
    useEffect(() => {
      return () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, []);
  
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const selectedFile = e.target.files[0];
        if (selectedFile.type === "text/plain" || selectedFile.name.endsWith('.txt')) {
          setFile(selectedFile);
          setDomain("");
        } else {
          toast({
            title: "Invalid file type",
            description: "Please upload a .txt file",
            variant: "destructive",
          });
        }
      }
    };
  
    const handleRunCrawler = async () => {
      if (activeTab === "single" && !domain) {
        setError("Domain is required");
        return;
      }
  
      if (activeTab === "batch" && !file) {
        setError("File is required");
        return;
      }
  
      setIsLoading(true);
      setError(null);
      setResults([]);
      const newSessionId = crypto.randomUUID();
      setSessionId(newSessionId);
      abortControllerRef.current = new AbortController();
  
      try {
        let response;
        
        if (activeTab === "single") {
          response = await fetch('/api/tools/url-crawler', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'X-Session-ID': newSessionId
            },
            body: JSON.stringify({ domain }),
            signal: abortControllerRef.current.signal
          });
        } else {
          const formData = new FormData();
          formData.append('file', file as Blob);
          
          response = await fetch('/api/tools/url-crawler', {
            method: 'POST',
            headers: {
              'X-Session-ID': newSessionId
            },
            body: formData,
            signal: abortControllerRef.current.signal
          });
        }
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to crawl URLs');
        }
  
        const data = await response.json();
        setResults(data.results || []);
  
        toast({
          title: "Crawling completed",
          description: `Found ${data.count || 0} URLs`,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          toast({
            title: "Crawling cancelled",
            description: "The crawler process was cancelled.",
            variant: "destructive",
          });
        } else {
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          setError(errorMessage);
          
          toast({
            title: "Error running crawler",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } finally {
        setIsLoading(false);
        setSessionId(null);
        abortControllerRef.current = null;
      }
    };
  
    const handleCloseAttempt = () => {
      if (isLoading) {
        setShowConfirmClose(true);
      } else {
        onClose();
      }
    };
  
    const stopCrawler = async () => {
      if (!sessionId) return;
      try {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        await fetch('/api/tools/url-crawler/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId })
        });
      } catch (error) {
        console.error("Failed to stop crawler", error);
      } finally {
        setIsLoading(false);
        setSessionId(null);
        abortControllerRef.current = null;
      }
    };
  
    const confirmClose = async () => {
      if (isLoading && sessionId) {
        await stopCrawler();
      }
      setShowConfirmClose(false);
      onClose();
    };
  
    const handleDownloadResults = () => {
      if (results.length === 0) {
        toast({
          title: "No results to download",
          description: "There are no URLs to download",
          variant: "destructive",
        });
        return;
      }
  
      try {
        const fileContent = results.join('\n');
        const fileName = file 
          ? `crawled-urls-from-file-${new Date().toISOString().slice(0, 10)}.txt`
          : `crawled-urls-${domain}-${new Date().toISOString().slice(0, 10)}.txt`;
  
        const blob = new Blob([fileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
  
        toast({
          title: "Download started",
          description: "URLs saved as plain text file",
        });
      } catch (error) {
        toast({
          title: "Download failed",
          description: "Could not save URLs",
          variant: "destructive",
        });
      }
    };
  
    const formatResults = () => {
      if (results.length === 0) return "No URLs found";
      return `CRAWLER RESULTS (${results.length} URLs found)\n\n${results.map(url => `• ${url}`).join('\n')}`;
    };
  
    return (
      <>
        <BaseToolModal tool={tool} isOpen={isOpen} onClose={handleCloseAttempt}>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>URL Crawler Configuration</CardTitle>
                <CardDescription>
                  {activeTab === "single" 
                    ? "Enter the domain to crawl" 
                    : "Upload a text file with domains (one per line)"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                    {error}
                  </div>
                )}
  
                <Tabs 
                  value={activeTab} 
                  onValueChange={(value) => {
                    setActiveTab(value as "single" | "batch");
                    setError(null);
                  }}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="single">Single Domain</TabsTrigger>
                    <TabsTrigger value="batch">Batch File</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="single" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="domain">Domain to Crawl</Label>
                      <Input
                        id="domain"
                        type="text"
                        placeholder="example.com"
                        value={domain}
                        onChange={(e) => {
                          setDomain(e.target.value.trim());
                          setFile(null);
                        }}
                        disabled={isLoading}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="batch" className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label>Domains List (TXT)</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {file ? file.name : "Upload File"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              className="hidden"
              disabled={isLoading}
            />
            {file && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Toggleable Format Guide */}
          <div className="border border-gray-700 rounded-md overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
              onClick={() => setShowFormatGuide(!showFormatGuide)}
            >
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium">File Format Guide</span>
              </div>
              <ChevronDown 
                className={`h-4 w-4 transition-transform ${showFormatGuide ? 'rotate-180' : ''}`}
              />
            </button>
            
            {showFormatGuide && (
              <div className="p-4 bg-gray-900/50 border-t border-gray-700">
                <div className="mb-3">
                  <p className="text-sm font-medium text-green-400 mb-1">✅ Correct format:</p>
                  <div className="bg-black/80 p-3 rounded text-xs font-mono">
                    <p>example.com</p>
                    <p>test-site.org</p>
                    <p>another-domain.net</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">• One domain per line</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-red-400 mb-1">❌ Incorrect format:</p>
                  <div className="bg-black/80 p-3 rounded text-xs font-mono">
                    <p>example.com/ ❌ (contains path)</p>
                    <p>1. domain.com ❌ (contains numbering)</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">• Avoid special characters</p>
                  <p className="text-xs text-gray-400">• No numbering or bullet points</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </TabsContent>

                </Tabs>
              </CardContent>
              <CardFooter>
                {isLoading ? (
                  <Button
                    onClick={stopCrawler}
                    variant="destructive"
                    className="w-full"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel Crawling
                  </Button>
                ) : (
                  <Button
                    onClick={handleRunCrawler}
                    disabled={activeTab === "single" ? !domain : !file}
                    className="w-full"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start Crawling
                  </Button>
                )}
              </CardFooter>
            </Card>
  
            {results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Crawler Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="bg-black p-4 rounded-md font-mono text-sm overflow-x-auto whitespace-pre-wrap">
                      {formatResults()}
                    </pre>
                    <div className="absolute top-2 right-2 flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          navigator.clipboard.writeText(formatResults());
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        aria-label="Copy results"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleDownloadResults}
                        aria-label="Download results"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {onSendToChat && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => onSendToChat(formatResults())}
                          aria-label="Send to chat"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </BaseToolModal>
  
        {/* Confirmation Dialog */}
        <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Crawling Process?</DialogTitle>
              <DialogDescription>
                The crawling process is still running. If you close now, progress will be lost and you'll need to start over.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Continue Crawling</Button>
              </DialogClose>
              <Button 
                variant="destructive" 
                onClick={confirmClose}
              >
                Cancel and Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }