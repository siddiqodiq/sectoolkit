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
  ShieldCheck,
  ShieldAlert
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface NucleiScanModalProps {
  tool: Tool;
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
}

const VULNERABILITY_PATTERNS = [
  { value: 'ssrf', label: 'SSRF' },
  { value: 'sqli', label: 'SQL Injection' },
  { value: 'xss', label: 'XSS' },
  { value: 'lfi', label: 'Local File Inclusion' },
  { value: 'ssti', label: 'Server-Side Template Injection' },
  { value: 'redirect', label: 'Open Redirect' }
];

export function NucleiScanModal({ tool, isOpen, onClose, onSendToChat }: NucleiScanModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [scanType, setScanType] = useState("single");
  const [pattern, setPattern] = useState("ssrf");
  const [copied, setCopied] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scanCompleted, setScanCompleted] = useState(false);
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
  const vulnerabilityMatch = cleanLine.match(/^\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] (.+)/);
  
  if (vulnerabilityMatch) {
    const [_, type, protocol, severity, url] = vulnerabilityMatch;
    return (
      <div className="flex flex-col gap-1 p-2 rounded bg-gray-800/50">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-mono ${
            severity === 'critical' ? 'bg-red-500/20 text-red-400' :
            severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
            severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-blue-500/20 text-blue-400'
          }`}>
            {severity}
          </span>
          <span className="text-sm font-medium">{type}</span>
        </div>
        <div className="font-mono text-sm break-all">
          {url}
        </div>
      </div>
    );
  }
  
  // For non-vulnerability lines (info, warnings, etc.)
  return <div className="font-mono text-sm">{cleanLine.trim()}</div>;
};

  const handleRunTool = async () => {
  if (!targetUrl) {
    setError("Target URL is required");
    return;
  }

  setIsLoading(true);
  setError(null);
  setResults([]);
  setScanCompleted(false);
  abortControllerRef.current = new AbortController();

  try {
    const formData = new FormData();
    formData.append('target', targetUrl);
    formData.append('scan_type', scanType);
    if (scanType === 'single') {
      formData.append('pattern', pattern);
    }

    const response = await fetch('/api/tools/nuclei-scan', {
      method: 'POST',
      body: formData,
      signal: abortControllerRef.current.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to start Nuclei scan');
    }

    const sessionId = response.headers.get('X-Session-ID');
    setSessionId(sessionId);

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    let accumulatedText = '';
    const decoder = new TextDecoder();
    let hasOutput = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const textChunk = decoder.decode(value, { stream: true });
      accumulatedText += textChunk;
      hasOutput = true;

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
      hasOutput = true;
    }

    // Explicitly handle empty output case
    if (!hasOutput) {
      setResults(['No vulnerabilities found']);
    }

    setScanCompleted(true);

    toast({
      title: hasOutput ? "Nuclei Scan completed" : "Scan completed",
      description: hasOutput 
        ? `Found ${results.filter(line => line.match(/^\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] (.+)/)).length} potential vulnerabilities` 
        : "No vulnerabilities detected in the target",
      variant: hasOutput ? "default" : "success"
    });

    setScanCompleted(true);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      toast({
        title: "Scan cancelled",
        description: "The Nuclei scan was cancelled.",
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
        description: "No Nuclei scan session to stop.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const stopResponse = await fetch('/api/tools/nuclei-scan/stop', {
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
        description: "The Nuclei scan has been cancelled",
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
      const fileName = `nuclei-scan-results-${new Date().toISOString().slice(0, 10)}.txt`;

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
              <CardTitle>Nuclei Vulnerability Scanner</CardTitle>
              <CardDescription>
                Comprehensive web vulnerability scanning using Nuclei
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

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="targetUrl">Target URL/Domain</Label>
                  <Input
                    id="targetUrl"
                    type="text"
                    placeholder="example.com or http://example.com"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Scan Type</Label>
                  <Select 
                    value={scanType} 
                    onValueChange={setScanType}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select scan type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Specific Vulnerability</SelectItem>
                      <SelectItem value="all">Comprehensive Scan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {scanType === 'single' && (
                  <div className="space-y-2">
                    <Label>Vulnerability Pattern</Label>
                    <Select 
                      value={pattern} 
                      onValueChange={setPattern}
                      disabled={isLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select pattern" />
                      </SelectTrigger>
                      <SelectContent>
                        {VULNERABILITY_PATTERNS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <Alert className="bg-gray-800/50 border-gray-700">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <p>• Comprehensive scan will check for all vulnerability types but takes longer</p>
                  <p>• Specific vulnerability scan is faster but only checks one type</p>
                  <p>• The scan may take several minutes depending on the target size</p>
                  <p>• Stopping the scan is only possible after the first output appears</p>
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                onClick={handleRunTool}
                disabled={isLoading || !targetUrl || (scanType === 'single' && !pattern)}
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
        {results.some(line => line.match(/^\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] (.+)/)) 
          ? `Found ${results.filter(line => line.match(/^\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] (.+)/)).length} vulnerabilities`
          : scanCompleted ? "Scan completed with no vulnerabilities found" : "Scan in progress"}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="relative">
        {results.length > 0 ? (
          results[0] === 'No vulnerabilities found' ? (
            <Alert variant="default">
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Scan Completed</AlertTitle>
              <AlertDescription>
                No vulnerabilities were found in the target.
              </AlertDescription>
            </Alert>
          ) : (
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
                        const cleanResults = results.map(cleanAnsiCodes).join('\n');
                        navigator.clipboard.writeText(cleanResults);
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
                        onClick={() => onSendToChat(results.map(cleanAnsiCodes).join('\n'))}
                        aria-label="Send to chat"
                        >
                        <Send className="h-4 w-4" />
                        </Button>
                    )}
                    </div>
                </>)
         ) : (
          <Alert variant="default">
            {scanCompleted ? (
              <>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Scan Completed</AlertTitle>
                <AlertDescription>
                  No vulnerabilities were found in the target.
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
              The Nuclei scan is still running. If you close now, the process will be cancelled.
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