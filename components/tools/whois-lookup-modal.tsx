// components/tools/whois-lookup-modal.tsx
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
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Alert, AlertDescription} from "@/components/ui/alert";
import { 
  Loader2, 
  Play, 
  Copy, 
  Download, 
  Check, 
  Send,
  AlertCircle,
  Search
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

interface WhoisLookupModalProps {
  tool: Tool;
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
}

export function WhoisLookupModal({ tool, isOpen, onClose, onSendToChat }: WhoisLookupModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState("");
  const [copied, setCopied] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const { toast } = useToast();

  const handleRunTool = async () => {
    if (!domain) {
      setError("Domain is required");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/tools/whois-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.replace(/^https?:\/\//i, '') }),
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to perform WHOIS lookup');
      }

      const data = await response.json();
      setResult(data.whois || "No WHOIS data found");

      toast({
        title: "WHOIS lookup completed",
        description: `Found registration details for ${data.domain}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setError(errorMessage);
      
      toast({
        title: "Error running tool",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
    if (!result) {
      toast({
        title: "No results to download",
        description: "There are no WHOIS results to download",
        variant: "destructive",
      });
      return;
    }

    try {
      const fileContent = result;
      const fileName = `whois-${domain}-${new Date().toISOString().slice(0, 10)}.txt`;

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
        description: "WHOIS results saved as text file",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not save WHOIS results",
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
              <CardTitle>WHOIS Lookup</CardTitle>
              <CardDescription>
                Query domain registration information and ownership details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="domain">Domain Name</Label>
                <Input
                  id="domain"
                  type="text"
                  placeholder="example.com (without http/https)"
                  value={domain}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    // Remove protocol if accidentally entered
                    setDomain(value.replace(/^https?:\/\//i, ''));
                  }}
                  disabled={isLoading}
                />
              </div>

              <Alert className="bg-gray-800/50 border-gray-700">
                <Search className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <p>• Reveals domain registration details</p>
                  <p>• Helps identify ownership and contact information</p>
                  <p>• Useful for reconnaissance and attribution</p>
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleRunTool}
                disabled={isLoading || !domain}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Querying...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Perform WHOIS Lookup
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle>WHOIS Results for {domain}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <pre className="bg-black p-4 rounded-md font-mono text-sm overflow-x-auto whitespace-pre-wrap">
                    {result}
                  </pre>
                  <div className="absolute top-2 right-2 flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        navigator.clipboard.writeText(result);
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
                        onClick={() => onSendToChat(result)}
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
            <DialogTitle>Cancel WHOIS Lookup?</DialogTitle>
            <DialogDescription>
              The WHOIS lookup is still running. If you close now, the query will be cancelled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Continue Lookup</Button>
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