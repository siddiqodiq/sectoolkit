"use client";
import { useState, useEffect } from "react";
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
import {Alert} from "@/components/ui/alert";
import { 
  Loader2, 
  Play, 
  Copy, 
  Download, 
  Check as CheckIcon,
  Send,
  AlertCircle,
  History,
  Filter
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDescription } from "../ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

interface WaybackDorkingModalProps {
  tool: Tool;
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
}

const FILE_TYPE_FILTERS = [
  { id: 'html', label: 'HTML', value: 'text/html' },
  { id: 'javascript', label: 'JavaScript', value: 'text/javascript|application/javascript' },
  { id: 'json', label: 'JSON', value: 'application/json' },
  { id: 'xml', label: 'XML', value: 'text/xml|application/xml' },
  { id: 'php', label: 'PHP', value: 'text/x-php|application/x-php|\\.php' },
  { id: 'plain', label: 'Plain Text', value: 'text/plain' },
  { id: 'csv', label: 'CSV', value: 'text/csv' },
  { id: 'pdf', label: 'PDF', value: 'application/pdf' },
  { id: 'word', label: 'Word Docs', value: 'application/msword|application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { id: 'excel', label: 'Excel Files', value: 'application/vnd.ms-excel|application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { id: 'powerpoint', label: 'PowerPoint', value: 'application/vnd.ms-powerpoint|application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  { id: 'archive', label: 'Archives', value: 'application/zip|application/x-rar-compressed|application/x-7z-compressed|application/x-tar|application/gzip|\\.zip|\\.rar|\\.7z|\\.tar|\\.gz' },
  { id: 'db', label: 'Database Files', value: '\\.db|\\.sqlite|\\.mdb|\\.accdb' },
  { id: 'sql', label: 'SQL Files', value: '\\.sql' },
];

const KEYWORD_FILTERS = [
  { id: 'admin', label: 'Admin', value: 'admin' },
  { id: 'root', label: 'Root', value: 'root' },
  { id: 'dbaccess', label: 'Database Access', value: 'dbaccess|database' },
  { id: 'config', label: 'Config', value: 'config|configuration' },
  { id: 'backup', label: 'Backup', value: 'backup' },
  { id: 'login', label: 'Login', value: 'login|signin' },
  { id: 'secret', label: 'Secrets', value: 'secret|password|credential' },
  { id: 'api', label: 'API', value: 'api' },
];

export function WaybackDorkingModal({ tool, isOpen, onClose, onSendToChat }: WaybackDorkingModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [allResults, setAllResults] = useState<string[]>([]);
  const [filteredResults, setFilteredResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [copied, setCopied] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [selectedFileFilters, setSelectedFileFilters] = useState<Record<string, boolean>>({});
  const [selectedKeywordFilters, setSelectedKeywordFilters] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  // Apply filters whenever allResults or filters change
  useEffect(() => {
    if (allResults.length === 0) {
      setFilteredResults([]);
      return;
    }

    // Get all selected file filters
    const activeFileFilters = FILE_TYPE_FILTERS
      .filter(filter => selectedFileFilters[filter.id])
      .map(filter => filter.value)
      .join('|');

    // Get all selected keyword filters
    const activeKeywordFilters = KEYWORD_FILTERS
      .filter(filter => selectedKeywordFilters[filter.id])
      .map(filter => filter.value)
      .join('|');

    // If no filters are selected, show empty array (we'll handle display logic separately)
    if (!activeFileFilters && !activeKeywordFilters) {
      setFilteredResults([]);
      return;
    }

    // Create regex patterns for filtering
    const fileFilterRegex = activeFileFilters ? new RegExp(`(${activeFileFilters})`, 'i') : null;
    const keywordFilterRegex = activeKeywordFilters ? new RegExp(`(${activeKeywordFilters})`, 'i') : null;

    const filtered = allResults.filter(url => {
      const matchesFile = activeFileFilters ? fileFilterRegex?.test(url) : false;
      const matchesKeyword = activeKeywordFilters ? keywordFilterRegex?.test(url) : false;
      
      // If both filters are active, match either one (OR condition)
      if (activeFileFilters && activeKeywordFilters) {
        return matchesFile || matchesKeyword;
      }
      // Otherwise match the active filter
      return activeFileFilters ? matchesFile : matchesKeyword;
    });

    setFilteredResults(filtered);
  }, [allResults, selectedFileFilters, selectedKeywordFilters]);

  const handleRunTool = async () => {
    if (target.includes('://')) {
      setError("Please enter domain without protocol (http/https)");
      return;
    }

    if (!target) {
      setError("Target domain is required");
      return;
    }

    setIsLoading(true);
    setError(null);
    setAllResults([]);
    setFilteredResults([]);
    setSelectedFileFilters({});
    setSelectedKeywordFilters({});

    try {
      const response = await fetch('/api/tools/wayback-dorking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch Wayback URLs');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        
        const newResults = fullContent.split('\n').filter(Boolean);
        setAllResults(newResults);
      }

      toast({
        title: "Wayback Dorking completed",
        description: `Found ${allResults.length} historical URLs`,
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
    const resultsToDownload = filteredResults.length > 0 ? filteredResults : allResults;
    
    if (resultsToDownload.length === 0) {
      toast({
        title: "No results to download",
        description: "There are no URLs to download",
        variant: "destructive",
      });
      return;
    }

    try {
      const fileContent = resultsToDownload.join('\n');
      const fileName = `wayback-urls-${target}-${new Date().toISOString().slice(0, 10)}.txt`;

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
        description: "Historical URLs saved as text file",
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
    const resultsToFormat = filteredResults.length > 0 ? filteredResults : allResults;
    const count = resultsToFormat.length;
    
    if (count === 0) {
      return allResults.length > 0 ? "No results match current filters" : "No historical URLs found";
    }
    
    let header = `WAYBACK URL RESULTS (${count} URLs found)`;
    
    // Add filter info if any filters are active
    const activeFileFilters = FILE_TYPE_FILTERS
      .filter(filter => selectedFileFilters[filter.id])
      .map(filter => filter.label);
      
    const activeKeywordFilters = KEYWORD_FILTERS
      .filter(filter => selectedKeywordFilters[filter.id])
      .map(filter => filter.label);
      
    const allActiveFilters = [...activeFileFilters, ...activeKeywordFilters];
    
    if (allActiveFilters.length > 0) {
      header += `\nFiltered by: ${allActiveFilters.join(', ')}`;
    }
    
    return `${header}\n\n${resultsToFormat.map(url => `• ${url}`).join('\n')}`;
  };

  const toggleFileFilter = (filterId: string) => {
    setSelectedFileFilters(prev => ({
      ...prev,
      [filterId]: !prev[filterId]
    }));
  };

  const toggleKeywordFilter = (filterId: string) => {
    setSelectedKeywordFilters(prev => ({
      ...prev,
      [filterId]: !prev[filterId]
    }));
  };

  const clearAllFilters = () => {
    setSelectedFileFilters({});
    setSelectedKeywordFilters({});
  };

  return (
    <>
      <BaseToolModal tool={tool} isOpen={isOpen} onClose={handleCloseAttempt}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Wayback URL Dorking</CardTitle>
              <CardDescription>
                Discover historical URLs from Wayback Machine archives
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="target">Target Domain</Label>
                <Input
                  id="target"
                  type="text"
                  placeholder="example.com (without http/https)"
                  value={target}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    setTarget(value.replace(/^https?:\/\//i, ''));
                  }}
                  disabled={isLoading}
                />
              </div>

              <Alert className="bg-gray-800/50 border-gray-700">
                <History className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <p>• This tool queries Wayback Machine archives</p>
                  <p>• Finds historical URLs that may reveal hidden endpoints</p>
                  <p>• Useful for passive reconnaissance</p>
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                onClick={handleRunTool}
                disabled={isLoading || !target}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching Archives...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Wayback Dorking
                  </>
                )}
              </Button>
              {allResults.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                </Button>
              )}
            </CardFooter>
          </Card>

          {showFilters && allResults.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Filter Results</CardTitle>
                    <CardDescription>
                      {filteredResults.length > 0 ? (
                        <span className="text-green-500">{filteredResults.length} results match filters</span>
                      ) : (
                        <span className="text-muted-foreground">No filters active</span>
                      )}
                    </CardDescription>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={clearAllFilters}
                    disabled={Object.keys(selectedFileFilters).length === 0 && Object.keys(selectedKeywordFilters).length === 0}
                  >
                    Clear All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium mb-3">File Types</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {FILE_TYPE_FILTERS.map(filter => (
                      <div key={filter.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`file-${filter.id}`}
                          checked={!!selectedFileFilters[filter.id]}
                          onCheckedChange={() => toggleFileFilter(filter.id)}
                        />
                        <Label htmlFor={`file-${filter.id}`}>{filter.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-3">Keywords</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {KEYWORD_FILTERS.map(filter => (
                      <div key={filter.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`keyword-${filter.id}`}
                          checked={!!selectedKeywordFilters[filter.id]}
                          onCheckedChange={() => toggleKeywordFilter(filter.id)}
                        />
                        <Label htmlFor={`keyword-${filter.id}`}>{filter.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                {filteredResults.length > 0 ? (
                  <>Filtered Results ({filteredResults.length} of {allResults.length})</>
                ) : (
                  <>All Results ({allResults.length})</>
                )}
              </CardTitle>
              <CardDescription>
                {filteredResults.length === 0 && allResults.length > 0 && (
                  <span className="text-muted-foreground">Select filters above to narrow down results</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="bg-black p-4 rounded-md font-mono text-sm overflow-x-auto max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap">
                    {formatResults()}
                  </pre>
                </div>
                {allResults.length > 0 && (
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
                        onClick={() => onSendToChat(formatResults())}
                        aria-label="Send to chat"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </BaseToolModal>

      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Wayback Search?</DialogTitle>
            <DialogDescription>
              The Wayback search is still running. If you close now, progress will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Continue Search</Button>
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