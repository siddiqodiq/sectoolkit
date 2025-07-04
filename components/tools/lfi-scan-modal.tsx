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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Loader2, 
  Play, 
  Copy, 
  Download, 
  Check as CheckIcon,
  Send,
  AlertCircle,
  StopCircle
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

interface LfiScanModalProps {
  tool: Tool;
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
}

export function LfiScanModal({ tool, isOpen, onClose, onSendToChat }: LfiScanModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [payloadFile, setPayloadFile] = useState<File | null>(null);
  const [scanMode, setScanMode] = useState("basic");
  const [advancedOptions, setAdvancedOptions] = useState({
    filter: false,
    successCriteria: "",
    useSuccessCriteria: false
  });
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

  const cleanAnsiCodes = (str: string) => {
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  };

  const formatResultLine = (line: string) => {
    const cleanLine = cleanAnsiCodes(line);
    
    if (cleanLine.includes('[VULNERABLE]')) {
      return (
        <div className="text-red-500 font-medium">
          {cleanLine}
        </div>
      );
    }
    
    if (cleanLine.includes('[INFO]') || cleanLine.includes('[DEBUG]')) {
      return (
        <div className="text-blue-500">
          {cleanLine}
        </div>
      );
    }
    
    return <div>{cleanLine}</div>;
  };

  const handleRunTool = async () => {
    if (!targetUrl && !targetFile) {
      setError("Either URL or file is required");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('mode', scanMode);
      
      if (targetUrl) {
        formData.append('url', targetUrl);
      } else if (targetFile) {
        formData.append('file', targetFile);
      }

      if (scanMode === 'advanced') {
        formData.append('filter', advancedOptions.filter.toString());
        
        if (advancedOptions.useSuccessCriteria && advancedOptions.successCriteria) {
          formData.append('success_criteria', advancedOptions.successCriteria);
        }

        if (payloadFile) {
          formData.append('payload_file', payloadFile);
        }
      }

      const response = await fetch('/api/tools/lfi-scan', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to start LFI scan');
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
        title: "Scan completed",
        description: `LFI scan finished for ${targetUrl || 'uploaded file'}`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast({
          title: "Scan cancelled",
          description: "The LFI scan was cancelled.",
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

  const stopScan = async () => {
    if (!sessionId) {
      toast({
        title: "No active scan session",
        description: "No scan session to stop.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const stopResponse = await fetch('/api/tools/lfi-scan/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!stopResponse.ok) {
        const errorData = await stopResponse.json();
        throw new Error(errorData.error || 'Failed to stop scan');
      }

      toast({
        title: "Scan stopped",
        description: "The LFI scan has been cancelled",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Error stopping scan",
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
      await stopScan();
    }
    setShowConfirmClose(false);
    onClose();
  };

  const handleDownloadResults = () => {
    if (!results.length) {
      toast({
        title: "No results to download",
        description: "There are no scan results to download",
        variant: "destructive",
      });
      return;
    }

    try {
      const fileContent = results.join('\n');
      const fileName = `lfi-scan-results-${new Date().toISOString().slice(0, 10)}.txt`;

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
        description: "Scan results saved as text file",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not save scan results",
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
              <CardTitle>LFI (Local File Inclusion) Scanner</CardTitle>
              <CardDescription>
                Detect local file inclusion vulnerabilities in web applications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                  {error}
                </div>
              )}

              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="basic" onClick={() => setScanMode('basic')}>Basic Mode</TabsTrigger>
                  <TabsTrigger value="advanced" onClick={() => setScanMode('advanced')}>Advanced Mode</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic">
                  <div className="space-y-4">
                    <Tabs defaultValue="url" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="url" onClick={() => setTargetFile(null)}>Single URL</TabsTrigger>
                        <TabsTrigger value="file" onClick={() => setTargetUrl("")}>Batch Scan</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="url">
                        <div className="space-y-2">
                          <Label htmlFor="targetUrl">Target URL</Label>
                          <Input
                            id="targetUrl"
                            type="text"
                            placeholder="http://example.com/vulnerable.php?file="
                            value={targetUrl}
                            onChange={(e) => setTargetUrl(e.target.value)}
                            disabled={isLoading}
                          />
                          <p className="text-xs text-muted-foreground">
                            URL must include the parameter to test (e.g., ?file=)
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="file">
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
                      </TabsContent>
                    </Tabs>
                  </div>
                </TabsContent>

                <TabsContent value="advanced">
                  <div className="space-y-4">
                    <Tabs defaultValue="url" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="url" onClick={() => setTargetFile(null)}>Single URL</TabsTrigger>
                        <TabsTrigger value="file" onClick={() => setTargetUrl("")}>Batch Scan</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="url">
                        <div className="space-y-2">
                          <Label htmlFor="targetUrlAdvanced">Target URL</Label>
                          <Input
                            id="targetUrlAdvanced"
                            type="text"
                            placeholder="http://example.com/vulnerable.php?file="
                            value={targetUrl}
                            onChange={(e) => setTargetUrl(e.target.value)}
                            disabled={isLoading}
                          />
                          <p className="text-xs text-muted-foreground">
                            URL must include the parameter to test (e.g., ?file=)
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="file">
                        <div className="space-y-2">
                          <Label htmlFor="targetFileAdvanced">Target URLs File</Label>
                          <Input
                            id="targetFileAdvanced"
                            type="file"
                            accept=".txt,.text"
                            onChange={(e) => setTargetFile(e.target.files?.[0] || null)}
                            disabled={isLoading}
                          />
                          <p className="text-xs text-muted-foreground">
                            Text file containing one URL per line
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="space-y-2">
                      <Label htmlFor="payloadFile">Custom Payload File (Optional)</Label>
                      <Input
                        id="payloadFile"
                        type="file"
                        accept=".txt,.text"
                        onChange={(e) => setPayloadFile(e.target.files?.[0] || null)}
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">
                        Text file containing custom LFI payloads (one per line)
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="filter" 
                          checked={advancedOptions.filter}
                          onCheckedChange={(checked) => setAdvancedOptions({...advancedOptions, filter: !!checked})}
                          disabled={isLoading}
                        />
                        <Label htmlFor="filter">Filter Results</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="useSuccessCriteria" 
                          checked={advancedOptions.useSuccessCriteria}
                          onCheckedChange={(checked) => setAdvancedOptions({...advancedOptions, useSuccessCriteria: !!checked})}
                          disabled={isLoading}
                        />
                        <Label htmlFor="useSuccessCriteria">Use Success Criteria</Label>
                      </div>

                      {advancedOptions.useSuccessCriteria && (
                        <div className="space-y-2 pl-6">
                          <Label htmlFor="successCriteria">Success Criteria</Label>
                          <Input
                            id="successCriteria"
                            type="text"
                            placeholder="root:x:"
                            value={advancedOptions.successCriteria}
                            onChange={(e) => setAdvancedOptions({...advancedOptions, successCriteria: e.target.value})}
                            disabled={isLoading}
                          />
                          <p className="text-xs text-muted-foreground">
                            String that indicates successful LFI (e.g., "root:x:" for /etc/passwd)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <Alert className="bg-gray-800/50 border-gray-700">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <p>• Basic mode: Simple LFI detection with default payloads</p>
                  <p>• Advanced mode: Custom payloads, filtering, and success criteria</p>
                  <p>• Example vulnerable URL: http://testphp.vulnweb.com/showimage.php?file=</p>
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
                    Scanning...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Scan
                  </>
                )}
              </Button>
              {isLoading && (
                <Button
                  onClick={stopScan}
                  variant="destructive"
                  className="flex-1"
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  Stop Scan
                </Button>
              )}
            </CardFooter>
          </Card>

          {results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Scan Results</CardTitle>
                <CardDescription>
                  {scanMode === 'advanced' && advancedOptions.filter 
                    ? "Showing filtered results" 
                    : "Showing all scan results"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <div className="bg-black p-4 rounded-md font-mono text-sm overflow-x-auto max-h-96 overflow-y-auto space-y-1">
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
                      {copied ? <CheckIcon className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
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
            <DialogTitle>Cancel Scan Process?</DialogTitle>
            <DialogDescription>
              The LFI scan is still running. If you close now, the process will be cancelled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Continue Scan</Button>
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