// components/tools/deep-crawler-modal.tsx
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
import {Button} from "@/components/ui/button";
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
  ChevronDown,
  StopCircle
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

interface DeepCrawlerModalProps {
  tool: Tool;
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
}

export function DeepCrawlerModal({ tool, isOpen, onClose, onSendToChat }: DeepCrawlerModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [copied, setCopied] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [noResultsFound, setNoResultsFound] = useState(false);
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

  const stopCrawl = async () => {
    if (!sessionId) return;
    try {
      const stopResponse = await fetch('/api/tools/deep-crawler/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (!stopResponse.ok) throw new Error('Failed to stop scan');
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
      setSessionId(null);
      abortControllerRef.current = null;
    }
  };

   const handleRunCrawler = async () => {
    if (!target) {
      setError("Target URL is required");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    setNoResultsFound(false);

    abortControllerRef.current = new AbortController();
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);

    try {
      const response = await fetch('/api/tools/deep-crawler', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({ target, session_id: newSessionId }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to crawl URLs');
      }

      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        setNoResultsFound(true);
        toast({
          title: "No URLs found",
          description: "The crawler didn't find any URLs on the target",
          variant: "default",
        });
      } else {
        setResults(data.results);
        toast({
          title: "Deep crawling completed",
          description: `Found ${data.count || 0} URLs`,
        });
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast({
          title: "Crawl cancelled",
          description: "The deep crawl was cancelled.",
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

  const confirmClose = async () => {
    if (isLoading && sessionId) {
      await stopCrawl();
    }
    setShowConfirmClose(false);
    onClose();
  };

  const handleDownloadResults = () => {
    if (results.length === 0 || noResultsFound) {
      toast({
        title: "No results to download",
        description: "There are no URLs to download",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create blob with explicit UTF-8 encoding
      const fileContent = results.join('\n');
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), fileContent], { 
        type: 'text/plain; charset=utf-8' 
      });
      
      const fileName = `deep-crawled-urls-${target.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().slice(0, 10)}.txt`;

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
    return `DEEP CRAWLER RESULTS (${results.length} URLs found)\n\n${results.map(url => `• ${url}`).join('\n')}`;
  };

  return (
    <>
      <BaseToolModal tool={tool} isOpen={isOpen} onClose={handleCloseAttempt}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deep URL Crawler</CardTitle>
              <CardDescription>
                Discover hidden URLs by deeply crawling the target website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="target">Target Website</Label>
                <Input
                  id="target"
                  type="text"
                  placeholder="example.com or https://example.com"
                  value={target}
                  onChange={(e) => setTarget(e.target.value.trim())}
                  disabled={isLoading}
                />
              </div>

              <div className="border border-gray-700 rounded-md overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                    <span className="text-sm font-medium">Advanced Options</span>
                  </div>
                </button>
                
                {showAdvanced && (
                  <div className="p-4 bg-gray-900/50 border-t border-gray-700">
                    <Alert className="bg-gray-800/50 border-gray-700">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <p>• Follows all links recursively</p>
                        <p>• Discovers hidden endpoints and parameters</p>
                        <p>• May take longer than standard crawling</p>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                onClick={handleRunCrawler}
                disabled={isLoading || !target}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Crawling...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Deep Crawl
                  </>
                )}
              </Button>
              {isLoading && (
                <Button
                  onClick={stopCrawl}
                  variant="destructive"
                  className="flex-1"
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  Stop Crawling
                </Button>
              )}
            </CardFooter>
          </Card>

          {results.length > 0 ? (
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
) : noResultsFound ? (
  <Card>
    <CardHeader>
      <CardTitle>No Results Found</CardTitle>
    </CardHeader>
    <CardContent>
      <Alert variant="default">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No URLs Discovered</AlertTitle>
        <AlertDescription>
          The deep crawler didn't find any accessible URLs on the target website.
          This could mean the site has strong protections against crawling or the
          target is not properly configured.
        </AlertDescription>
      </Alert>
    </CardContent>
  </Card>
) : null}

        </div>
      </BaseToolModal>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Crawling Process?</DialogTitle>
            <DialogDescription>
              The deep crawling process is still running. If you close now, progress will be lost and you'll need to start over.
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