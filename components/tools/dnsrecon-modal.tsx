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
  Globe
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

interface DnsReconModalProps {
  tool: Tool;
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
}

export function DnsReconModal({ tool, isOpen, onClose, onSendToChat }: DnsReconModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState("");
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

  const formatResultLine = (line: string) => {
    // Color code different record types
    if (line.includes('SOA')) return <span className="text-purple-400">{line}</span>;
    if (line.includes('NS')) return <span className="text-blue-400">{line}</span>;
    if (line.includes('MX')) return <span className="text-green-400">{line}</span>;
    if (line.includes('A ')) return <span className="text-yellow-400">{line}</span>;
    if (line.includes('AAAA')) return <span className="text-orange-400">{line}</span>;
    if (line.includes('TXT')) return <span className="text-pink-400">{line}</span>;
    if (line.includes('SRV')) return <span className="text-cyan-400">{line}</span>;
    if (line.includes('CNAME')) return <span className="text-lime-400">{line}</span>;
    if (line.includes('[-]')) return <span className="text-red-400">{line}</span>;
    if (line.includes('[*]')) return <span className="text-gray-400">{line}</span>;
    return <span>{line}</span>;
  };

  const handleRunTool = async () => {
    if (!domain) {
      setError("Domain is required");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    setScanCompleted(false);
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/tools/dnsrecon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to start DNS reconnaissance');
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
        title: "DNS Recon completed",
        description: `Found ${results.length} DNS records`,
        variant: "default"
      });

      setScanCompleted(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast({
          title: "Scan cancelled",
          description: "The DNS reconnaissance was cancelled.",
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
        description: "No DNS recon session to stop.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const stopResponse = await fetch('/api/tools/dnsrecon/stop', {
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
        description: "The DNS reconnaissance has been cancelled",
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
      const fileName = `dns-recon-results-${domain}-${new Date().toISOString().slice(0, 10)}.txt`;

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
              <CardTitle>DNS Reconnaissance</CardTitle>
              <CardDescription>
                Enumerate DNS records for a domain
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

              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  type="text"
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the domain to enumerate (e.g., example.com)
                </p>
              </div>

              <Alert className="bg-gray-800/50 border-gray-700">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <p>• Will enumerate SOA, NS, MX, A, AAAA, TXT, and SRV records</p>
                  <p>• Stopping the scan will cancel the ongoing enumeration</p>
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                onClick={handleRunTool}
                disabled={isLoading || !domain}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Globe className="mr-2 h-4 w-4" />
                    Start Recon
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
                <CardTitle>DNS Records</CardTitle>
                <CardDescription>
                  {results.length > 0 
                    ? `Found ${results.length} DNS records` 
                    : "No records found"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {results.length > 0 ? (
                    <>
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
                      <ShieldCheck className="h-4 w-4" />
                      <AlertTitle>No DNS records found</AlertTitle>
                      <AlertDescription>
                        The scan completed but no DNS records were found for this domain.
                      </AlertDescription>
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
              The DNS reconnaissance is still running. If you close now, the process will be cancelled.
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