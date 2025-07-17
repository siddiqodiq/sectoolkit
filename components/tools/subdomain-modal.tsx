// components/tools/subdomain-modal.tsx
"use client"
import { ChangeEvent, useRef, useState } from "react"
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
import { Loader2, Play, Copy, Download, Check, Send, Upload, X } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { validateDomain } from "@/app/api/tools/utils/validators"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "../ui/label"
import { Tabs } from "../ui/tabs"
import { Switch } from "../ui/switch"

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
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "text/plain" || selectedFile.name.endsWith('.txt')) {
        setFile(selectedFile);
      } else {
        toast({
          title: "Invalid file type",
          description: "upload a .txt file",
          variant: "destructive",
        });
      }
    }
  };

  const handleEnumeration = async () => {
    if (!domain) {
      setError("Domain is required");
      return;
    }

    setIsLoading(true);
    setError(null);
    setEnumerationResults([]);

    try {
      const response = await fetch('/api/tools/subdomain/enumeration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
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

  // components/tools/subdomain-modal.tsx
  const handleActiveCheck = async () => {
    if (!file && !activeCheckDomain) {
      setError("Either domain or file must be provided");
      return;
    }
  
    setIsLoading(true);
    setError(null);
    setActiveCheckResults([]);
  
    try {
      const formData = new FormData();
      
      if (file) {
        formData.append("file", file);
      } else {
        // Pastikan menggunakan nama field 'domain' yang konsisten
        formData.append("domain", activeCheckDomain);
      }
  
      const response = await fetch('/api/tools/subdomain/active-check', {
        method: 'POST',
        body: formData,
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
    <BaseToolModal tool={tool} isOpen={isOpen} onClose={onClose}>
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
                  <Label>Domain or File</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      placeholder="example.com"
                      value={activeCheckDomain}
                      onChange={(e) => {
                        setActiveCheckDomain(e.target.value.trim());
                        setFile(null);
                      }}
                      disabled={isLoading || !!file}
                    />
                    <span className="text-sm text-muted-foreground">OR</span>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading || !!activeCheckDomain}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {file ? file.name : "Upload File"}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={isLoading || !!activeCheckDomain}
                    />
                    {file && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activeCheckDomain 
                      ? "Will check active subdomains for this domain" 
                      : "Upload a text file with one domain or subdomain per line"}
                  </p>
                </div>
                <Button
                  onClick={handleActiveCheck}
                  disabled={isLoading || (!activeCheckDomain && !file)}
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
            <CardContent>
              <div className="relative">
                <pre className="bg-black p-4 rounded-md font-mono text-sm overflow-x-auto whitespace-pre-wrap">
                  {currentResults}
                </pre>
                <div className="absolute top-2 right-2 flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      navigator.clipboard.writeText(currentResults);
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
                    disabled={
                      (activeTab === "enumeration" && enumerationResults.length === 0) ||
                      (activeTab === "activeCheck" && activeCheckResults.length === 0)
                    }
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {onSendToChat && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => onSendToChat(currentResults)}
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
  );
}