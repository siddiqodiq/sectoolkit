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

interface UrlFuzzerModalProps {
  tool: Tool;
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
}

export function UrlFuzzerModal({ tool, isOpen, onClose, onSendToChat }: UrlFuzzerModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [wordlistFile, setWordlistFile] = useState<File | null>(null);
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
const formatResultLine = (line: string) => {
  // Hilangkan karakter ANSI
  let cleanLine = line.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

  // Extract the payload and status
  const payloadMatch = cleanLine.match(/^(.+?)\s+\[Status:\s*(\d+)/);
  if (payloadMatch) {
    const payload = payloadMatch[1];
    const status = payloadMatch[2];
    const fullUrl = `${targetUrl.replace("FUZZ", "")}${payload}`;

    if (status === '200') {
      return (
        <div className="text-muted-foreground">
          <a 
            href={fullUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-green-500 hover:text-green-400 hover:underline"
          >
            {fullUrl} [Status: {status}]
          </a>
        </div>
      );
    } else {
      return (
        <div className="text-muted-foreground">
          {fullUrl} [Status: {status}]
        </div>
      );
    }
  }

  // Fallback for lines that don't match the expected format
  return <div className="text-muted-foreground">{cleanLine}</div>;
};

  const handleRunTool = async () => {
    if (!targetUrl) {
      setError("Target URL is required");
      return;
    }

    if (!wordlistFile) {
      setError("Wordlist file is required");
      return;
    }

    if (!targetUrl.includes("FUZZ")) {
      setError("Target URL must contain 'FUZZ' placeholder");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('target', targetUrl);
      formData.append('file', wordlistFile);

      const response = await fetch('/api/tools/fuzz', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to start URL fuzzing');
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
        title: "URL Fuzzing completed",
        description: `Found ${results.length} potential paths`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast({
          title: "Fuzzing cancelled",
          description: "The URL fuzzing was cancelled.",
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

  const stopFuzzing = async () => {
    if (!sessionId) {
      toast({
        title: "No active fuzzing session",
        description: "No URL fuzzing session to stop.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const stopResponse = await fetch('/api/tools/fuzz/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!stopResponse.ok) {
        const errorData = await stopResponse.json();
        throw new Error(errorData.error || 'Failed to stop fuzzing');
      }

      toast({
        title: "Fuzzing stopped",
        description: "The URL fuzzing has been cancelled",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Error stopping fuzzing",
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
      await stopFuzzing();
    }
    setShowConfirmClose(false);
    onClose();
  };

  const handleDownloadResults = () => {
    if (!results.length) {
      toast({
        title: "No results to download",
        description: "There are no fuzzing results to download",
        variant: "destructive",
      });
      return;
    }

    try {
      const fileContent = results.join('\n');
      const fileName = `url-fuzzing-results-${new Date().toISOString().slice(0, 10)}.txt`;

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
        description: "Fuzzing results saved as text file",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not save fuzzing results",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <BaseToolModal tool={tool} isOpen={isOpen} onClose={handleCloseAttempt}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-muted-foreground">
          <a href="http://example.com/payload" target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline">
          </a>
        </div>
          <Card>
            <CardHeader>
              <CardTitle>URL Fuzzer</CardTitle>
              <CardDescription>
                Discover hidden paths and parameters by fuzzing URLs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="targetUrl">Target URL (must contain FUZZ)</Label>
                  <Input
                    id="targetUrl"
                    type="text"
                    placeholder="http://example.com/page.php?param=FUZZ"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    The word "FUZZ" will be replaced with each word from your wordlist
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wordlist">Wordlist File</Label>
                  <Input
                    id="wordlist"
                    type="file"
                    accept=".txt,.text"
                    onChange={(e) => setWordlistFile(e.target.files?.[0] || null)}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Text file containing one payload per line
                  </p>
                </div>

                <Alert className="bg-gray-800/50 border-gray-700">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <p>• URL must contain the exact string "FUZZ" which will be replaced</p>
                    <p>• Example: http://testphp.vulnweb.com/showimage.php?file=FUZZ</p>
                    <p>• Wordlist should contain one payload per line</p>
                    <p>• Stopping the fuzzing is only possible after the first output appears</p>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                onClick={handleRunTool}
                disabled={isLoading || !targetUrl || !wordlistFile || !targetUrl.includes("FUZZ")}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fuzzing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Fuzzing
                  </>
                )}
              </Button>
              {isLoading && (
                <Button
                  onClick={stopFuzzing}
                  variant="destructive"
                  className="flex-1"
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  Stop Fuzzing
                </Button>
              )}
            </CardFooter>
          </Card>

          {results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Fuzzing Results</CardTitle>
                <CardDescription>
                  Found {results.length} potential paths
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
            <DialogTitle>Cancel Fuzzing Process?</DialogTitle>
            <DialogDescription>
              The URL fuzzing is still running. If you close now, the process will be cancelled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Continue Fuzzing</Button>
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