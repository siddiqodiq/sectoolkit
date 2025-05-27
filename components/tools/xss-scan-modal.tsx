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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Loader2, 
  Play, 
  Copy, 
  Download, 
  Check, 
  Send,
  AlertCircle,
  StopCircle,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface XssScanModalProps {
  tool: Tool;
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
}

export function XssScanModal({ tool, isOpen, onClose, onSendToChat }: XssScanModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [customPayloadFile, setCustomPayloadFile] = useState<File | null>(null);
  const [scanMode, setScanMode] = useState("1");
  const [copied, setCopied] = useState(false);
  const [scanCompleted, setScanCompleted] = useState(false);
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
    const pocMatch = cleanLine.match(/\[POC\]\[(\w+)\]\[(\w+)\]\[([^\]]+)\]\s+(http.+)/);
    if (pocMatch) {
      const [_, severity, method, type, url] = pocMatch;
      return (
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground">[{severity}]</span>
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline break-all"
          >
            {url}
          </a>
        </div>
      );
    }
    return <div>{cleanLine.trim()}</div>;
  };

   const handleRunTool = async () => {
    if (['1', '2', '3'].includes(scanMode) && !targetUrl) {
      setError("Target URL is required for this mode");
      return;
    }

    if (['4', '5', '6'].includes(scanMode) && !targetFile) {
      setError("Target file is required for this mode");
      return;
    }

    if (['3', '6'].includes(scanMode) && !customPayloadFile) {
      setError("Custom payload file is required for this mode");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    setScanCompleted(false);
    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('mode', scanMode);
      
      if (['1', '2', '3'].includes(scanMode)) {
        formData.append('target_url', targetUrl);
      } else if (targetFile) {
        formData.append('target_file', targetFile);
      }

      if (['3', '6'].includes(scanMode) && customPayloadFile) {
        formData.append('custom_payload', customPayloadFile);
      }

      const response = await fetch('/api/tools/xss-scan', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to start XSS scan');
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

      // Check if any vulnerabilities were found
      const vulnerabilitiesFound = results.some(line => 
        line.includes('[POC]') || 
        line.toLowerCase().includes('vulnerable') || 
        line.toLowerCase().includes('xss')
      );

      toast({
        title: vulnerabilitiesFound ? "XSS Scan completed" : "No vulnerabilities found",
        description: vulnerabilitiesFound 
          ? `Found ${results.length} potential vulnerabilities` 
          : "No XSS vulnerabilities detected in the target",
        variant: vulnerabilitiesFound ? "default" : "success"
      });

      setScanCompleted(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast({
          title: "Scan cancelled",
          description: "The XSS scan was cancelled.",
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
        description: "No XSS scan session to stop.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const stopResponse = await fetch('/api/tools/xss-scan/stop', {
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
        description: "The XSS scan has been cancelled on both frontend and backend",
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
      const fileName = `xss-scan-results-${new Date().toISOString().slice(0, 10)}.txt`;

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
              <CardTitle>XSS Scanner (Dalfox)</CardTitle>
              <CardDescription>
                Detect Cross-Site Scripting vulnerabilities using Dalfox
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Tabs defaultValue="single" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="single" onClick={() => setScanMode('1')}>Single URL</TabsTrigger>
                  <TabsTrigger value="batch" onClick={() => setScanMode('4')}>Batch Scan</TabsTrigger>
                </TabsList>
                
                <TabsContent value="single">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="targetUrl">Target URL</Label>
                      <Input
                        id="targetUrl"
                        type="text"
                        placeholder="http://example.com/search?q=test"
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">
                        URL must contain query parameters to test
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Payload Mode</Label>
                      <Select 
                        value={scanMode} 
                        onValueChange={setScanMode}
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payload mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Default Payload</SelectItem>
                          <SelectItem value="2">PortSwigger Payload</SelectItem>
                          <SelectItem value="3">Custom Payload</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {scanMode === '3' && (
                      <div className="space-y-2">
                        <Label htmlFor="customPayload">Custom Payload File</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="customPayload"
                            type="file"
                            accept=".txt,.text"
                            onChange={(e) => setCustomPayloadFile(e.target.files?.[0] || null)}
                            disabled={isLoading}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Text file containing one XSS payload per line
                        </p>
                      </div>
                    )}
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

                    <div className="space-y-2">
                      <Label>Payload Mode</Label>
                      <Select 
                        value={scanMode} 
                        onValueChange={setScanMode}
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payload mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4">Default Payload</SelectItem>
                          <SelectItem value="5">PortSwigger Payload</SelectItem>
                          <SelectItem value="6">Custom Payload</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {scanMode === '6' && (
                      <div className="space-y-2">
                        <Label htmlFor="customPayloadBatch">Custom Payload File</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="customPayloadBatch"
                            type="file"
                            accept=".txt,.text"
                            onChange={(e) => setCustomPayloadFile(e.target.files?.[0] || null)}
                            disabled={isLoading}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Text file containing one XSS payload per line
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

               <Alert className="bg-gray-800/50 border-gray-700">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <p>• For single URL scan, include query parameters in the URL</p>
                  <p>• Example: http://testphp.vulnweb.com/search.php?test=query</p>
                  <p>• Batch scan requires a text file with one URL per line</p>
                  <p>• Stopping the scan is only possible after the first output appears. To force close, you can close this tool popup.</p>
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                onClick={handleRunTool}
                disabled={isLoading || 
                  (['1', '2', '3'].includes(scanMode) && !targetUrl) ||
                  (['4', '5', '6'].includes(scanMode) && !targetFile) ||
                  (['3', '6'].includes(scanMode) && !customPayloadFile)}
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

          {(results.length > 0 || scanCompleted) && (
            <Card>
              <CardHeader>
                <CardTitle>Scan Results</CardTitle>
                <CardDescription>
                  {results.some(line => line.includes('[POC]')) 
                    ? `Found ${results.filter(line => line.includes('[POC]')).length} potential vulnerabilities`
                    : "No vulnerabilities found"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {results.length > 0 ? (
                    <>
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
                    </>
                  ) : (
                    <Alert variant={scanCompleted ? "default" : "default"}>
                      {scanCompleted ? (
                        <>
                          <ShieldCheck className="h-4 w-4" />
                          <AlertTitle>No vulnerabilities found</AlertTitle>
                          <AlertDescription>
                            The scan completed successfully but no XSS vulnerabilities were detected in the target. You can try different payloads or check the target manually.
                          </AlertDescription>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="h-4 w-4" />
                          <AlertTitle>Scan in progress</AlertTitle>
                          <AlertDescription>
                            The scan is currently running. Results will appear here when available.
                          </AlertDescription>
                        </>
                      )}
                    </Alert>
                  )}
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
              The XSS scan is still running. If you close now, the process will be cancelled.
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