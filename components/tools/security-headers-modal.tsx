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
  Check as CheckIcon,
  Send,
  AlertCircle,
  StopCircle,
  Shield,
  XCircle,
  CheckCircle
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface SecurityHeadersModalProps {
  tool: Tool;
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
}

interface SecurityResult {
  results?: string;
  status?: string;
  url?: string;
}

export function SecurityHeadersModal({ tool, isOpen, onClose, onSendToChat }: SecurityHeadersModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [parsedResults, setParsedResults] = useState<SecurityResult | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
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

  // Add connection status monitoring
  useEffect(() => {
    let statusInterval: NodeJS.Timeout;
    
    if (isLoading && lastActivity) {
      statusInterval = setInterval(() => {
        const timeSinceLastActivity = Date.now() - lastActivity.getTime();
        if (timeSinceLastActivity > 30000) { // 30 seconds without activity
          setStatus("Security check may be slow, please wait...");
        }
      }, 5000);
    }

    return () => {
      if (statusInterval) clearInterval(statusInterval);
    };
  }, [isLoading, lastActivity]);

  const cleanAnsiCodes = (str: string) => {
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  };

  const formatResultLine = (line: string) => {
    const cleanLine = cleanAnsiCodes(line);
    
    // Handle different types of security messages
    if (cleanLine.includes('[!] Missing security header:')) {
      const headerName = cleanLine.split(':')[1]?.trim();
      return (
        <div className="flex items-center text-red-400 py-1">
          <XCircle className="h-4 w-4 mr-2" />
          <span>Missing: <span className="font-medium">{headerName}</span></span>
        </div>
      );
    }
    
    if (cleanLine.includes('[+] There are') && cleanLine.includes('security headers')) {
      const match = cleanLine.match(/\[+\] There are (\d+) security headers/);
      const count = match ? match[1] : '0';
      return (
        <div className="flex items-center text-green-400 py-1 font-medium">
          <CheckCircle className="h-4 w-4 mr-2" />
          <span>Found {count} security headers</span>
        </div>
      );
    }
    
    if (cleanLine.includes('[-] There are not') && cleanLine.includes('security headers')) {
      const match = cleanLine.match(/\[-\] There are not (\d+) security headers/);
      const count = match ? match[1] : '0';
      return (
        <div className="flex items-center text-red-400 py-1 font-medium">
          <XCircle className="h-4 w-4 mr-2" />
          <span>Missing {count} security headers</span>
        </div>
      );
    }
    
    if (cleanLine.includes('[*] Analyzing headers of') || cleanLine.includes('[*] Effective URL:')) {
      return (
        <div className="text-blue-400 py-1">
          {cleanLine}
        </div>
      );
    }
    
    if (cleanLine.includes('======') || cleanLine.includes('------')) {
      return (
        <div className="text-gray-500 py-1">
          {cleanLine}
        </div>
      );
    }
    
    return <div className="py-1">{cleanLine}</div>;
  };

  const parseSecurityResults = (data: any) => {
    try {
      if (typeof data === 'string') {
        // Try to parse as JSON
        const parsed = JSON.parse(data);
        setParsedResults(parsed);
        
        if (parsed.results) {
          const lines = parsed.results.split('\n');
          setResults(lines.filter((line: string) => line.trim()));
        }
      } else if (data && typeof data === 'object') {
        setParsedResults(data);
        
        if (data.results) {
          const lines = data.results.split('\n');
          setResults(lines.filter((line: string) => line.trim()));
        }
      }
    } catch (parseError) {
      console.warn('Failed to parse security results as JSON:', parseError);
      // If it's not JSON, treat as raw text
      if (typeof data === 'string') {
        const lines = data.split('\n');
        setResults(lines.filter(line => line.trim()));
      }
    }
  };

  const handleRunTool = async () => {
    if (!targetUrl) {
      setError("URL is required");
      return;
    }

    setIsLoading(true);
    setIsConnecting(true);
    setError(null);
    setResults([]);
    setParsedResults(null);
    setStatus("Initializing security headers check...");
    setLastActivity(new Date());
    abortControllerRef.current = new AbortController();

    try {
      setStatus("Connecting to security checker...");

      const response = await fetch('/api/tools/check-headers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to check security headers');
      }

      const sessionId = response.headers.get('X-Session-ID');
      setSessionId(sessionId);
      setIsConnecting(false);
      setStatus("Connected to security checker");

      // Check if response is JSON or streaming
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        // Handle JSON response
        const data = await response.json();
        setLastActivity(new Date());
        parseSecurityResults(data);
        setStatus("Security headers check completed");
      } else {
        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        let accumulatedText = '';
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          setLastActivity(new Date());

          // Process complete SSE messages or JSON objects
          if (buffer.includes('\n\n')) {
            const messages = buffer.split('\n\n');
            buffer = messages.pop() || '';

            for (const message of messages) {
              if (message.trim().startsWith('data: ')) {
                try {
                  const jsonStr = message.replace('data: ', '');
                  const data = JSON.parse(jsonStr);

                  switch (data.type) {
                    case 'status':
                      setStatus(data.message);
                      break;
                    case 'data':
                      parseSecurityResults(data.content);
                      setStatus("Processing security headers...");
                      break;
                    case 'complete':
                      setStatus("Security headers check completed");
                      break;
                    case 'error':
                      throw new Error(data.message);
                  }
                } catch (parseError) {
                  // If it's not SSE format, try to parse as direct JSON
                  try {
                    const data = JSON.parse(message);
                    parseSecurityResults(data);
                    setStatus("Security headers check completed");
                  } catch (jsonError) {
                    // Treat as raw text
                    accumulatedText += message;
                  }
                }
              } else {
                accumulatedText += message;
              }
            }
          } else {
            // Try to parse accumulated text as JSON
            try {
              const data = JSON.parse(buffer);
              parseSecurityResults(data);
              setStatus("Security headers check completed");
              break;
            } catch (jsonError) {
              // Continue accumulating
              accumulatedText += chunk;
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer);
            parseSecurityResults(data);
          } catch (jsonError) {
            accumulatedText += buffer;
          }
        }

        // If we have accumulated text, process it
        if (accumulatedText.trim()) {
          const lines = accumulatedText.split('\n');
          setResults(lines.filter(line => line.trim()));
        }
      }

      toast({
        title: "Check completed",
        description: `Security headers checked for ${targetUrl}`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus("Check cancelled");
        toast({
          title: "Check cancelled",
          description: "The security headers check was cancelled.",
          variant: "destructive",
        });
      } else {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        setError(errorMessage);
        setStatus("Error occurred");
        toast({
          title: "Error running tool",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
      setIsConnecting(false);
      setSessionId(null);
      abortControllerRef.current = null;
    }
  };

  const stopScan = async () => {
    if (!sessionId) {
      toast({
        title: "No active check session",
        description: "No check session to stop.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const stopResponse = await fetch('/api/tools/check-headers/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!stopResponse.ok) {
        const errorData = await stopResponse.json();
        throw new Error(errorData.error || 'Failed to stop check');
      }

      toast({
        title: "Check stopped",
        description: "The security headers check has been cancelled",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Error stopping check",
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
        description: "There are no check results to download",
        variant: "destructive",
      });
      return;
    }

    try {
      const fileContent = results.join('\n');
      const fileName = `security-headers-${targetUrl.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.txt`;

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
        description: "Security headers results saved as text file",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not save check results",
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
              <CardTitle>Security Headers Checker</CardTitle>
              <CardDescription>
                Check for missing security headers on a web server
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                  {error}
                </div>
              )}


              <div className="space-y-2">
                <Label htmlFor="targetUrl">Target URL</Label>
                <Input
                  id="targetUrl"
                  type="text"
                  placeholder="https://example.com"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the URL to check for security headers
                </p>
              </div>

              <Alert className="bg-gray-800/50 border-gray-700">
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <p>• Checks for common security headers like CSP, HSTS, X-Frame-Options</p>
                  <p>• Identifies missing security headers that could expose vulnerabilities</p>
                  <p>• Example: https://example.com</p>
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                onClick={handleRunTool}
                disabled={isLoading || !targetUrl}
                className="flex-1"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Check Headers
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
                  Stop Check
                </Button>
              )}
            </CardFooter>
          </Card>

    

          {/* Results section */}
          {(results.length > 0 || isLoading) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  Security Headers Results
                  {isLoading && (
                    <div className="ml-2 flex items-center text-sm text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-1" />
                      Live
                    </div>
                  )}
                </CardTitle>
                <CardDescription>
                  Detailed security headers analysis
                  {results.length > 0 && ` (${results.length} items)`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <div className="bg-black p-4 rounded-md font-mono text-sm overflow-x-auto max-h-96 overflow-y-auto space-y-1">
                    {results.length === 0 && isLoading ? (
                      <div className="text-gray-400 flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking security headers...
                      </div>
                    ) : (
                      results.map((result, index) => (
                        <div key={index}>
                          {formatResultLine(result)}
                        </div>
                      ))
                    )}
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
            <DialogTitle>Cancel Security Headers Check?</DialogTitle>
            <DialogDescription>
              The security headers check is still running. If you close now, the process will be cancelled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Continue Check</Button>
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