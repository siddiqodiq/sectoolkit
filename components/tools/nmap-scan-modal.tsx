// components/tools/nmap-scan-modal.tsx
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
import {Button} from "@/components/ui/button";
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
  Shield,
  Network,
  Server,
  Zap,
  Lock,
  StopCircle
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

interface NmapScanModalProps {
  tool: Tool;
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
}

const scanTypes = [
  {
    id: "1",
    name: "Version Detection",
    description: "Deteksi versi software yang berjalan",
    icon: <Server className="h-5 w-5" />
  },
  {
    id: "2",
    name: "Common Web Ports",
    description: "Scan port web umum (80, 443, 8080, etc)",
    icon: <Network className="h-5 w-5" />
  },
  {
    id: "3",
    name: "Web Service Detection",
    description: "Deteksi layanan web dan teknologinya",
    icon: <Shield className="h-5 w-5" />
  },
  {
    id: "4",
    name: "Aggressive Scan",
    description: "Scan lebih dalam dengan deteksi OS dan versi",
    icon: <Zap className="h-5 w-5" />
  },
  {
    id: "5",
    name: "TLS/SSL Check",
    description: "Pemeriksaan keamanan TLS/SSL",
    icon: <Lock className="h-5 w-5" />
  }
];

export function NmapScanModal({ tool, isOpen, onClose, onSendToChat }: NmapScanModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [scanType, setScanType] = useState("3"); // Default to Web Service Detection
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const stopScan = async () => {
    if (!sessionId) return;
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const stopResponse = await fetch('/api/tools/nmap-scan/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!stopResponse.ok) throw new Error('Failed to stop scan');
    } catch (error) {
      console.error(error);
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

  const handleRunScan = async () => {
    if (!target) {
      setError("Target is required");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults("");
    abortControllerRef.current = new AbortController();
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);

    try {
      const response = await fetch('/api/tools/nmap-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, scan_type: scanType, session_id: newSessionId }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run Nmap scan');
      }

      const data = await response.json();
      setResults(data.results || "No results returned");

      toast({
        title: "Scan completed",
        description: `Nmap ${scanTypes.find(t => t.id === scanType)?.name} scan finished`,
      });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setError(errorMessage);
      
      toast({
        title: "Scan failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setSessionId(null);
      abortControllerRef.current = null;
    }
  };

  const handleDownloadResults = () => {
    if (!results) return;
    
    const blob = new Blob([results], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nmap-scan-${target}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Download started",
      description: "Scan results saved as text file",
    });
  };

  return (
    <>
      <BaseToolModal tool={tool} isOpen={isOpen} onClose={handleCloseAttempt}>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Nmap Network Scanner</CardTitle>
            <CardDescription>
              Powerful port scanning and network reconnaissance tool
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="target">Target Host</Label>
              <Input
                id="target"
                type="text"
                placeholder="example.com or IP address"
                value={target}
                onChange={(e) => setTarget(e.target.value.trim())}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label>Scan Type</Label>
              <RadioGroup 
                value={scanType} 
                onValueChange={setScanType}
                className="grid gap-2 grid-cols-2 md:grid-cols-5"
              >
                {scanTypes.map((type) => (
                  <div key={type.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={type.id} id={type.id} />
                    <Label htmlFor={type.id} className="flex flex-col">
                      <span className="flex items-center gap-1">
                        {type.icon}
                        {type.name}
                      </span>
                      <span className="text-xs text-gray-400 font-normal">
                        {type.description}
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Alert className="bg-gray-800/50 border-gray-700">
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Nmap helps identify open ports, services, and vulnerabilities on network hosts.
                Use responsibly and only on systems you have permission to scan.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <div className="flex gap-2 w-full">
              <Button
                onClick={handleRunScan}
                disabled={isLoading || !target}
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
                    Run Nmap Scan
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
            </div>
          </CardFooter>
        </Card>

        {results && (
          <Card>
            <CardHeader>
              <CardTitle>Scan Results</CardTitle>
              <CardDescription>
                {scanTypes.find(t => t.id === scanType)?.name} scan results
              </CardDescription>
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
            <DialogTitle>Cancel Scan Process?</DialogTitle>
            <DialogDescription>
              The Nmap scanner is still running. If you close now, the process will be cancelled.
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