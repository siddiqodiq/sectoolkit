// components/tools/cors-scanner-modal.tsx
"use client";
import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Loader2, 
  Play, 
  Copy, 
  Download, 
  Check, 
  Send,
  AlertCircle,
  ShieldAlert
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { stripAnsiCodes } from "@/utils/ansi";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

interface CorsScannerModalProps {
  tool: Tool;
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
}

export function CorsScannerModal({ tool, isOpen, onClose, onSendToChat }: CorsScannerModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const { toast } = useToast();

  const handleRunScan = async () => {
    if (!url) {
      setError("URL is required");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults("");

    try {
      const response = await fetch('/api/tools/cors-scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to scan for CORS misconfigurations');
      }

      const data = await response.json();
      const formattedResults = formatCorsResults(data.raw_output, data.target);
      setResults(formattedResults);

      toast({
        title: "Scan completed",
        description: "CORS misconfiguration scan finished",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setError(errorMessage);
      
      toast({
        title: "Error running scanner",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCorsResults = (rawOutput: string, target: any): string => {
  try {
    // Hanya hilangkan kode warna ANSI, tampilkan hasil mentah
    return stripAnsiCodes(rawOutput);
  } catch (err) {
    console.error('Format error:', err);
    return 'Could not format results';
  }
};

  const handleCloseAttempt = () => {
    if (isLoading) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const confirmClose = () => {
    setIsLoading(false);
    setShowConfirmClose(false);
    onClose();
  };

  const handleDownloadResults = () => {
    if (!results) return;
    
    try {
      const fileName = `cors-scan-${url.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().slice(0, 10)}.txt`;
      const blob = new Blob([results], { type: 'text/plain' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      toast({
        title: "Download started",
        description: "CORS scan results saved",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not save results",
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
              <CardTitle>CORS Misconfiguration Scanner</CardTitle>
              <CardDescription>
                Scan for Cross-Origin Resource Sharing (CORS) misconfigurations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="url">Target URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com/api"
                  value={url}
                  onChange={(e) => setUrl(e.target.value.trim())}
                  disabled={isLoading}
                />
              </div>

              <Alert className="bg-yellow-500/10 border-yellow-500/30">
                <ShieldAlert className="h-4 w-4 text-yellow-500" />
                <AlertDescription className="text-yellow-500">
                  This scanner will test for potentially dangerous CORS configurations that could allow cross-origin attacks.
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleRunScan}
                disabled={isLoading || !url}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Scan for CORS Issues
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {results && (
            <Card>
              <CardHeader>
                <CardTitle>Scan Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <pre className="bg-black p-4 rounded-md font-mono text-sm overflow-x-auto whitespace-pre-wrap">
                    {results}
                  </pre>
                  <div className="absolute top-2 right-2 flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        navigator.clipboard.writeText(results);
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
                        onClick={() => onSendToChat(results)}
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
            <DialogTitle>Cancel Scanning Process?</DialogTitle>
            <DialogDescription>
              The CORS scan is still running. If you close now, progress will be lost and you'll need to start over.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Continue Scanning</Button>
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