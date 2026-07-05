// components/tools/subdomain-modal.tsx
"use client"
import { ChangeEvent, useRef, useState, useEffect } from "react"
import { BaseToolModal } from "./base-tool-modal"
import { Tool } from "@/lib/tools"
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardFooter 
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Play, Copy, Download, Check, Send, Upload, X, StopCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { validateDomain } from "@/app/api/tools/utils/validators"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "../ui/label"
import { Tabs } from "../ui/tabs"
import { Switch } from "../ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "../ui/dialog"

interface SubdomainModalProps {
    tool: Tool;
    isOpen: boolean;
    onClose: () => void;
    onSendToChat?: (content: string) => void;
  }

type ActiveUrlResult = {
  url: string;
  status_code: number;
  final_url?: string;
};

export function SubdomainModal({ tool, isOpen, onClose, onSendToChat }: SubdomainModalProps) {
  const [activeTab, setActiveTab] = useState<"enumeration" | "activeCheck">("enumeration");
  const [isLoading, setIsLoading] = useState(false);
  const [enumerationResults, setEnumerationResults] = useState<string[]>([]);
  const [activeCheckResults, setActiveCheckResults] = useState<ActiveUrlResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState("");
  const [activeCheckDomain, setActiveCheckDomain] = useState("");
  const [copied, setCopied] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
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

  const stopScan = async (type: 'enumeration' | 'activeCheck') => {
    if (!sessionId) {
      toast({
        title: "No active scan session",
        description: "No scan session to stop.",
        variant: "destructive",
      });
      return;
    }

    try {
      const endpoint = type === 'enumeration' 
        ? '/api/tools/subdomain/enumeration/stop' 
        : '/api/tools/subdomain/active-check/stop';

      const stopResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      if (!stopResponse.ok) {
        const errorData = await stopResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to stop scan');
      }

      toast({
        title: "Scan stopped",
        description: `The ${type === 'enumeration' ? 'subdomain enumeration' : 'active check'} scan has been cancelled`,
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
      await stopScan(activeTab);
    }
    setShowConfirmClose(false);
    onClose();
  };

  const handleEnumeration = async () => {
    if (!domain) {
      setError("Domain is required");
      return;
    }

    setIsLoading(true);
    setError(null);
    setEnumerationResults([]);
    abortControllerRef.current = new AbortController();
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);

    try {
      const response = await fetch('/api/tools/subdomain/enumeration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, session_id: newSessionId }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to enumerate subdomains');
      }

      const data = await response.json();
      setEnumerationResults(data.subdomains);

      toast({
        title: "Enumeration completed",
        description: `Found ${data.subdomains.length} subdomains`,
      });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast({
          title: "Scan cancelled",
          description: "The subdomain enumeration was cancelled.",
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

  // components/tools/subdomain-modal.tsx
  const handleActiveCheck = async () => {
    if (!activeCheckDomain) {
      setError("Domain must be provided");
      return;
    }
  
    setIsLoading(true);
    setError(null);
    setActiveCheckResults([]);
    abortControllerRef.current = new AbortController();
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
  
    try {
      const formData = new FormData();
      formData.append("domain", activeCheckDomain);
  
      formData.append('session_id', newSessionId);
      const response = await fetch('/api/tools/subdomain/active-check', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check active subdomains');
      }
  
      const data = await response.json();
      setActiveCheckResults(data.activeUrls || []);
  
      toast({
        title: "Active check completed",
        description: `Found ${data.count || 0} active URLs`,
      });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast({
          title: "Scan cancelled",
          description: "The active subdomain check was cancelled.",
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

  const formatEnumerationResults = () => {
    if (enumerationResults.length === 0) return "No subdomains found";
    return `SUBDOMAIN ENUMERATION RESULTS\n\n${enumerationResults.map(s => `• ${s}`).join('\n')}\n\nFound ${enumerationResults.length} subdomains`;
  };

  const formatActiveCheckResults = () => {
    if (activeCheckResults.length === 0) return "No active subdomains found";
    return `ACTIVE SUBDOMAIN RESULTS\n\n${activeCheckResults.map(url => 
      `• ${url.url} (Status: ${url.status_code})${url.final_url ? ` → ${url.final_url}` : ''}`
    ).join('\n')}\n\nFound ${activeCheckResults.length} active subdomains`;
  };

  const handleDownloadResults = () => {
    // Cek apakah ada hasil untuk didownload
    const hasEnumerationResults = enumerationResults.length > 0;
    const hasActiveCheckResults = activeCheckResults.length > 0;
    
    if (!hasEnumerationResults && !hasActiveCheckResults) {
      toast({
        title: "Tidak ada hasil untuk didownload",
        description: "Belum ada hasil yang ditemukan",
        variant: "destructive",
      });
      return;
    }
  
    try {
      let fileContent = '';
      let fileName = '';
      let resultCount = 0;
      
      if (activeTab === "enumeration" && hasEnumerationResults) {
        // Download hasil enumeration
        fileContent = enumerationResults.join('\n');
        fileName = `subdomains-enumeration-${new Date().toISOString().slice(0, 10)}.txt`;
        resultCount = enumerationResults.length;
      } else if (activeTab === "activeCheck" && hasActiveCheckResults) {
        // Download hasil active check
        const cleanUrls = activeCheckResults.map(result => {
          // Gunakan final_url jika ada dan berbeda dengan URL awal
          return result.final_url && result.final_url !== result.url 
            ? result.final_url 
            : result.url;
        });
        fileContent = cleanUrls.join('\n');
        fileName = `active-subdomains-${new Date().toISOString().slice(0, 10)}.txt`;
        resultCount = cleanUrls.length;
      } else {
        toast({
          title: "Tidak ada hasil untuk didownload",
          description: "Tidak ada hasil pada tab yang aktif",
          variant: "destructive",
        });
        return;
      }
  
      // Proses download
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
        title: "Download berhasil",
        description: `Berhasil menyimpan ${resultCount} hasil`,
      });
    } catch (error) {
      toast({
        title: "Download gagal",
        description: "Gagal menyimpan hasil",
        variant: "destructive",
      });
      console.error("Download error:", error);
    }
  };

  const currentResults = activeTab === "enumeration" 
    ? formatEnumerationResults() 
    : formatActiveCheckResults();

  return (
    <>
      <BaseToolModal tool={tool} isOpen={isOpen} onClose={handleCloseAttempt}>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Subdomain Tools</CardTitle>
            <CardDescription>Choose between enumeration or active subdomain check</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                {error}
              </div>
            )}

            <Tabs 
              value={activeTab} 
              onValueChange={(value) => {
                setActiveTab(value as "enumeration" | "activeCheck");
                setError(null);
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="enumeration">Enumeration</TabsTrigger>
                <TabsTrigger value="activeCheck">Active Check</TabsTrigger>
              </TabsList>
              
              <TabsContent value="enumeration" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain to Enumerate</Label>
                  <Input
                    id="domain"
                    type="text"
                    placeholder="example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value.trim())}
                    disabled={isLoading}
                  />
                </div>
                <Button
                  onClick={handleEnumeration}
                  disabled={isLoading || !domain}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enumerating...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Find Subdomains
                    </>
                  )}
                </Button>
              </TabsContent>
              
              <TabsContent value="activeCheck" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Input
                      type="text"
                      placeholder="example.com"
                      value={activeCheckDomain}
                      onChange={(e) => setActiveCheckDomain(e.target.value.trim())}
                      disabled={isLoading}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Check which subdomains are actively serving HTTP/HTTPS.
                  </p>
                </div>
                
                <Button
                  onClick={handleActiveCheck}
                  disabled={isLoading || !activeCheckDomain}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Check Active Subdomains
                    </>
                  )}
                </Button>
              </TabsContent>
              {isLoading && (
                <Button
                  onClick={() => stopScan(activeTab)}
                  variant="destructive"
                  className="w-full mt-4"
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  Stop {activeTab === 'enumeration' ? 'Enumeration' : 'Active Check'}
                </Button>
              )}
            </Tabs>
          </CardContent>
        </Card>

        {(enumerationResults.length > 0 || activeCheckResults.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>
                {activeTab === "enumeration" ? "Enumeration Results" : "Active Check Results"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <pre className="bg-black p-4 rounded-md font-mono text-sm overflow-x-auto whitespace-pre-wrap max-h-[40vh] overflow-y-auto">
                {currentResults}
              </pre>
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    navigator.clipboard.writeText(currentResults);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  aria-label="Copy results"
                  className="flex-1 sm:flex-none"
                >
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleDownloadResults}
                  aria-label="Download results"
                  className="flex-1 sm:flex-none"
                  disabled={
                    (activeTab === "enumeration" && enumerationResults.length === 0) ||
                    (activeTab === "activeCheck" && activeCheckResults.length === 0)
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span>Download</span>
                </Button>
                {onSendToChat && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => onSendToChat(currentResults)}
                    aria-label="Send to chat"
                    className="flex-1 sm:flex-none"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    <span>Send</span>
                  </Button>
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
              The {activeTab === 'enumeration' ? 'subdomain enumeration' : 'active subdomain check'} is still running. If you close now, the process will be cancelled.
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