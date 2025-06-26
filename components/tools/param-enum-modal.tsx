"use client";
import { useState, useRef, useEffect } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Loader2, 
  Play, 
  Copy, 
  Download, 
  Check, 
  Send,
  AlertCircle,
  StopCircle
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ParamEnumModalProps {
  tool: Tool;
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
}

const PATTERN_OPTIONS = [
  { value: 'idor', label: 'IDOR' },
  { value: 'rce', label: 'RCE' },
  { value: 'sqli', label: 'SQL Injection' },
  { value: 'lfi', label: 'Local File Inclusion' },
  { value: 'img-traversal', label: 'Image Traversal' }
];

export function ParamEnumModal({ tool, isOpen, onClose, onSendToChat }: ParamEnumModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [pattern, setPattern] = useState("idor");
  const [copied, setCopied] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();
  const resultsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (resultsEndRef.current) {
      resultsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [results]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const cleanOutputLine = (line: string) => {
    return line.trim();
  };

  const formatResultLine = (line: string) => {
    const cleanLine = cleanOutputLine(line);
    if (cleanLine.startsWith('http')) {
      return (
        <a 
          href={cleanLine} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline break-all"
        >
          {cleanLine}
        </a>
      );
    }
    return <div>{cleanLine}</div>;
  };

  const handleRunTool = async () => {
    if (!targetUrl && !targetFile) {
      setError("Either URL or file is required");
      return;
    }

    if (!pattern) {
      setError("Pattern is required");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('pattern', pattern);
      
      if (targetUrl) {
        formData.append('url', targetUrl);
      } else if (targetFile) {
        formData.append('file', targetFile);
      }

      const response = await fetch('/api/tools/enumerate-params', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to start enumeration');
      }

      const sessionId = response.headers.get('X-Session-ID');
      setSessionId(sessionId);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      let accumulatedText = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const textChunk = decoder.decode(value, { stream: true });
        accumulatedText += textChunk;

        const lines = accumulatedText.split('\n');
        accumulatedText = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            setResults(prev => [...prev, line]);
          }
        }
      }

      if (accumulatedText.trim()) {
        setResults(prev => [...prev, accumulatedText]);
      }

      toast({
        title: "Enumeration completed",
        description: `Found ${results.length} parameter patterns`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast({
          title: "Enumeration cancelled",
          description: "The parameter enumeration was cancelled.",
          variant: "destructive",
        });
      } else {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        setError(errorMessage);
        toast({
          title: "Error running tool",
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

  const stopEnumeration = async () => {
    if (!sessionId) {
      toast({
        title: "No active enumeration session",
        description: "No enumeration session to stop.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const stopResponse = await fetch('/api/tools/enumerate-params/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!stopResponse.ok) {
        const errorData = await stopResponse.json();
        throw new Error(errorData.error || 'Failed to stop enumeration');
      }

      toast({
        title: "Enumeration stopped",
        description: "The parameter enumeration has been cancelled",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Error stopping enumeration",
        description: errorMessage,
        variant: "destructive",
      });
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

  const confirmClose = async () => {
    if (isLoading && sessionId) {
      await stopEnumeration();
    }
    setShowConfirmClose(false);
    onClose();
  };

  const handleDownloadResults = () => {
    if (!results.length) {
      toast({
        title: "No results to download",
        description: "There are no enumeration results to download",
        variant: "destructive",
      });
      return;
    }

    try {
      const fileContent = results.join('\n');
      const fileName = `param-enum-results-${pattern}-${new Date().toISOString().slice(0, 10)}.txt`;

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
        description: "Enumeration results saved as text file",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not save enumeration results",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <BaseToolModal tool={tool} isOpen={isOpen} onClose={handleCloseAttempt}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Web Parameter Enumeration</CardTitle>
              <CardDescription>
                Discover interesting parameters using waybackurls, gau, and gf patterns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                  {error}
                </div>
              )}

              <Tabs defaultValue="single" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="single" onClick={() => setTargetFile(null)}>Single URL</TabsTrigger>
                  <TabsTrigger value="batch" onClick={() => setTargetUrl("")}>Batch Scan</TabsTrigger>
                </TabsList>
                
                <TabsContent value="single">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="targetUrl">Target URL</Label>
                      <Input
                        id="targetUrl"
                        type="text"
                        placeholder="http://example.com"
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">
                        Base URL to enumerate parameters from
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="batch">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="targetFile">Target URLs File</Label>
                      <Input
                        id="targetFile"
                        type="file"
                        accept=".txt,.text"
                        onChange={(e) => setTargetFile(e.target.files?.[0] || null)}
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">
                        Text file containing one URL per line
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-2">
                <Label>Parameter Pattern</Label>
                <Select 
                  value={pattern} 
                  onValueChange={setPattern}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parameter pattern" />
                  </SelectTrigger>
                  <SelectContent>
                    {PATTERN_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select the type of parameters to look for
                </p>
              </div>

              <Alert className="bg-gray-800/50 border-gray-700">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <p>• Uses waybackurls and gau to find historical URLs</p>
                  <p>• Applies gf patterns to filter interesting parameters</p>
                  <p>• Processes results through qsreplace</p>
                  <p>• Example patterns: IDOR, RCE, SQLi, LFI, img-traversal</p>
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                onClick={handleRunTool}
                disabled={isLoading || (!targetUrl && !targetFile)}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enumerating...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Enumeration
                  </>
                )}
              </Button>
              {isLoading && (
                <Button
                  onClick={stopEnumeration}
                  variant="destructive"
                  className="flex-1"
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  Stop Enumeration
                </Button>
              )}
            </CardFooter>
          </Card>

          {results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Enumeration Results ({pattern})</CardTitle>
                <CardDescription>
                  Found {results.length} parameter patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <div className="bg-black p-4 rounded-md font-mono text-sm overflow-x-auto max-h-96 overflow-y-auto space-y-2">
                    {results.map((result, index) => (
                      <div key={index}>
                        {formatResultLine(result)}
                      </div>
                    ))}
                    <div ref={resultsEndRef} />
                  </div>
                  <div className="absolute top-2 right-2 flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        navigator.clipboard.writeText(results.join('\n'));
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
                        onClick={() => onSendToChat(results.join('\n'))}
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

      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Enumeration Process?</DialogTitle>
            <DialogDescription>
              The parameter enumeration is still running. If you close now, the process will be cancelled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Continue Enumeration</Button>
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