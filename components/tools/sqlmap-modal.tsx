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
  ShieldAlert,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

interface SqlScanModalProps {
  tool: Tool;
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
}

export function SqlScanModal({ tool, isOpen, onClose, onSendToChat }: SqlScanModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [targetType, setTargetType] = useState<"url" | "logfile">("url");
  const [requestOptions, setRequestOptions] = useState({
    data: "",
    cookie: "",
    randomAgent: false,
    proxy: "",
    useTor: false
  });
  const [injectionOptions, setInjectionOptions] = useState({
    testParameter: "",
    dbms: "",
    tamper: "",
    level: "",
    risk: "",
    technique: ""
  });
  const [enumerationOptions, setEnumerationOptions] = useState({
    banner: false,
    currentUser: false,
    currentDb: false,
    hostname: false,
    isDba: false,
    users: false,
    passwords: false,
    privileges: false,
    roles: false,
    dbs: false,
    tables: false,
    columns: false,
    schema: false,
    dump: false,
    dumpAll: false,
    search: false,
    comments: false,
    statements: false,
    specificDb: "",
    specificTable: "",
    specificColumn: ""
  });
  const [osOptions, setOsOptions] = useState({
    osShell: false,
    osPwn: false
  });
  const [generalOptions, setGeneralOptions] = useState({
    flushSession: false
  });
  const [copied, setCopied] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
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

  const handleRunTool = async () => {
  if (!targetUrl && targetType === "url") {
    setError("Target URL is required");
    return;
  }

  if (!targetFile && targetType === "logfile") {
    setError("Log file is required");
    return;
  }

  setIsLoading(true);
  setError(null);
  setResults([]);
  setScanCompleted(false);
  abortControllerRef.current = new AbortController();

  try {
    const formData = new FormData();
    formData.append('target_type', targetType);
    
    if (targetType === "url") {
      formData.append('target', targetUrl);
    } else if (targetFile) {
      formData.append('logfile', targetFile);
    }

    // Add request options
    if (requestOptions.data) formData.append('data', requestOptions.data);
    if (requestOptions.cookie) formData.append('cookie', requestOptions.cookie);
    if (requestOptions.randomAgent) formData.append('random_agent', 'true');
    if (requestOptions.proxy) formData.append('proxy', requestOptions.proxy);
    if (requestOptions.useTor) formData.append('tor', 'true');

    // Add injection options
    if (injectionOptions.testParameter) formData.append('test_parameter', injectionOptions.testParameter);
    if (injectionOptions.dbms) formData.append('dbms', injectionOptions.dbms);
    if (injectionOptions.tamper) formData.append('tamper', injectionOptions.tamper);
    if (injectionOptions.level) formData.append('level', injectionOptions.level);
    if (injectionOptions.risk) formData.append('risk', injectionOptions.risk);
    if (injectionOptions.technique) formData.append('technique', injectionOptions.technique);

    // Add enumeration options
    Object.entries(enumerationOptions).forEach(([key, value]) => {
      if (typeof value === 'boolean' && value) {
        formData.append(key, 'true');
      } else if (value) {
        formData.append(key, value);
      }
    });

    // Add OS options
    if (osOptions.osShell) formData.append('os_shell', 'true');
    if (osOptions.osPwn) formData.append('os_pwn', 'true');

    // Add general options
    if (generalOptions.flushSession) formData.append('flush_session', 'true');

    const response = await fetch('/api/tools/sqlscan', {
      method: 'POST',
      body: formData,
      signal: abortControllerRef.current.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to start SQL scan');
    }

    const sessionId = response.headers.get('X-Session-ID');
    setSessionId(sessionId);

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    let accumulatedText = '';
    const decoder = new TextDecoder();

    // Filter untuk header SQLMap dan pesan logging
    const isUnwantedLine = (line: string): boolean => {
      // Header SQLMap
      const headerPatterns = [
        '___',
        '__H__',
        /___ ___.*{.*}/,
        /\|_ -\|.*\|/,
        /\|___\|_.*\|/,
        /\|_.*https:\/\/sqlmap\.org/,
      ];
      // Pesan logging
      const loggingPattern = /\[\d{2}:\d{2}:\d{2}\] \[INFO\] fetched data logged to text files under/;

      return (
        headerPatterns.some(pattern =>
          typeof pattern === 'string' ? line.includes(pattern) : pattern.test(line)
        ) || loggingPattern.test(line)
      );
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const textChunk = decoder.decode(value, { stream: true });
      accumulatedText += textChunk;

      const lines = accumulatedText.split('\n');
      accumulatedText = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() && !isUnwantedLine(line)) {
          setResults(prev => [...prev, line]);
        }
      }
    }

    if (accumulatedText.trim() && !isUnwantedLine(accumulatedText)) {
      setResults(prev => [...prev, accumulatedText]);
    }

    // Check if any vulnerabilities were found
    const vulnerabilitiesFound = results.some(line => 
      line.includes('Parameter:') || 
      line.toLowerCase().includes('injection') || 
      line.toLowerCase().includes('vulnerable')
    );

    toast({
      title: vulnerabilitiesFound ? "SQL Injection Scan completed" : "No vulnerabilities found",
      description: vulnerabilitiesFound 
        ? "Potential SQL injection vulnerabilities detected" 
        : "No SQL injection vulnerabilities detected in the target",
      variant: vulnerabilitiesFound ? "default" : "success"
    });

    setScanCompleted(true);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      toast({
        title: "Scan cancelled",
        description: "The SQL scan was cancelled.",
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
        description: "No SQL scan session to stop.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const stopResponse = await fetch('/api/tools/sqlscan/stop', {
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
        description: "The SQL scan has been cancelled",
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
      const fileName = `sql-scan-results-${new Date().toISOString().slice(0, 10)}.txt`;

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
              <CardTitle>SQL Injection Scanner (SQLMap)</CardTitle>
              <CardDescription>
                Detect SQL injection vulnerabilities using SQLMap
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

              <Tabs 
                defaultValue="url" 
                className="w-full"
                onValueChange={(value) => setTargetType(value as "url" | "logfile")}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="url">URL Target</TabsTrigger>
                  <TabsTrigger value="logfile">Log File</TabsTrigger>
                </TabsList>
                
                <TabsContent value="url">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="targetUrl">Target URL</Label>
                      <Input
                        id="targetUrl"
                        type="text"
                        placeholder="http://example.com/search?q=test"
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">
                        URL must contain query parameters to test
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="logfile">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="targetFile">Log File</Label>
                      <Input
                        id="targetFile"
                        type="file"
                        accept=".log,.txt"
                        onChange={(e) => setTargetFile(e.target.files?.[0] || null)}
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">
                        HTTP traffic log file containing requests
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <Collapsible>
                <CollapsibleTrigger 
                  className="flex items-center justify-between w-full py-2 font-medium"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <span>Advanced Options</span>
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                <div className="space-y-4">
                    <h4 className="font-medium">Enumeration Options</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="banner"
                          checked={enumerationOptions.banner}
                          onCheckedChange={(checked) => setEnumerationOptions({...enumerationOptions, banner: checked})}
                          disabled={isLoading}
                        />
                        <Label htmlFor="banner">DBMS Banner</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="currentUser"
                          checked={enumerationOptions.currentUser}
                          onCheckedChange={(checked) => setEnumerationOptions({...enumerationOptions, currentUser: checked})}
                          disabled={isLoading}
                        />
                        <Label htmlFor="currentUser">Current User</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="currentDb"
                          checked={enumerationOptions.currentDb}
                          onCheckedChange={(checked) => setEnumerationOptions({...enumerationOptions, currentDb: checked})}
                          disabled={isLoading}
                        />
                        <Label htmlFor="currentDb">Current DB</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="hostname"
                          checked={enumerationOptions.hostname}
                          onCheckedChange={(checked) => setEnumerationOptions({...enumerationOptions, hostname: checked})}
                          disabled={isLoading}
                        />
                        <Label htmlFor="hostname">Hostname</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="isDba"
                          checked={enumerationOptions.isDba}
                          onCheckedChange={(checked) => setEnumerationOptions({...enumerationOptions, isDba: checked})}
                          disabled={isLoading}
                        />
                        <Label htmlFor="isDba">Is DBA</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="users"
                          checked={enumerationOptions.users}
                          onCheckedChange={(checked) => setEnumerationOptions({...enumerationOptions, users: checked})}
                          disabled={isLoading}
                        />
                        <Label htmlFor="users">Users</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="passwords"
                          checked={enumerationOptions.passwords}
                          onCheckedChange={(checked) => setEnumerationOptions({...enumerationOptions, passwords: checked})}
                          disabled={isLoading}
                        />
                        <Label htmlFor="passwords">Passwords</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="privileges"
                          checked={enumerationOptions.privileges}
                          onCheckedChange={(checked) => setEnumerationOptions({...enumerationOptions, privileges: checked})}
                          disabled={isLoading}
                        />
                        <Label htmlFor="privileges">Privileges</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="dbs"
                          checked={enumerationOptions.dbs}
                          onCheckedChange={(checked) => setEnumerationOptions({...enumerationOptions, dbs: checked})}
                          disabled={isLoading}
                        />
                        <Label htmlFor="dbs">Databases</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="tables"
                          checked={enumerationOptions.tables}
                          onCheckedChange={(checked) => setEnumerationOptions({...enumerationOptions, tables: checked})}
                          disabled={isLoading}
                        />
                        <Label htmlFor="tables">Tables</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="columns"
                          checked={enumerationOptions.columns}
                          onCheckedChange={(checked) => setEnumerationOptions({...enumerationOptions, columns: checked})}
                          disabled={isLoading}
                        />
                        <Label htmlFor="columns">Columns</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="dump"
                          checked={enumerationOptions.dump}
                          onCheckedChange={(checked) => setEnumerationOptions({...enumerationOptions, dump: checked})}
                          disabled={isLoading}
                        />
                        <Label htmlFor="dump">Dump Table</Label>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="specificDb">Specific DB</Label>
                        <Input
                          id="specificDb"
                          type="text"
                          placeholder="database_name"
                          value={enumerationOptions.specificDb}
                          onChange={(e) => setEnumerationOptions({...enumerationOptions, specificDb: e.target.value})}
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="specificTable">Specific Table</Label>
                        <Input
                          id="specificTable"
                          type="text"
                          placeholder="table_name"
                          value={enumerationOptions.specificTable}
                          onChange={(e) => setEnumerationOptions({...enumerationOptions, specificTable: e.target.value})}
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="specificColumn">Specific Column</Label>
                        <Input
                          id="specificColumn"
                          type="text"
                          placeholder="column_name"
                          value={enumerationOptions.specificColumn}
                          onChange={(e) => setEnumerationOptions({...enumerationOptions, specificColumn: e.target.value})}
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium">Request Options</h4>
                    <div className="space-y-2">
                      <Label htmlFor="requestData">POST Data</Label>
                      <Input
                        id="requestData"
                        type="text"
                        placeholder="param1=value1&param2=value2"
                        value={requestOptions.data}
                        onChange={(e) => setRequestOptions({...requestOptions, data: e.target.value})}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cookie">Cookie</Label>
                      <Input
                        id="cookie"
                        type="text"
                        placeholder="PHPSESSID=1234; security=low"
                        value={requestOptions.cookie}
                        onChange={(e) => setRequestOptions({...requestOptions, cookie: e.target.value})}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="randomAgent"
                        checked={requestOptions.randomAgent}
                        onCheckedChange={(checked) => setRequestOptions({...requestOptions, randomAgent: checked})}
                        disabled={isLoading}
                      />
                      <Label htmlFor="randomAgent">Random User-Agent</Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proxy">Proxy</Label>
                      <Input
                        id="proxy"
                        type="text"
                        placeholder="http://127.0.0.1:8080"
                        value={requestOptions.proxy}
                        onChange={(e) => setRequestOptions({...requestOptions, proxy: e.target.value})}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="useTor"
                        checked={requestOptions.useTor}
                        onCheckedChange={(checked) => setRequestOptions({...requestOptions, useTor: checked})}
                        disabled={isLoading}
                      />
                      <Label htmlFor="useTor">Use Tor Network</Label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Injection Options</h4>
                    <div className="space-y-2">
                      <Label htmlFor="testParameter">Test Parameter</Label>
                      <Input
                        id="testParameter"
                        type="text"
                        placeholder="id,user,name"
                        value={injectionOptions.testParameter}
                        onChange={(e) => setInjectionOptions({...injectionOptions, testParameter: e.target.value})}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dbms">DBMS</Label>
                      <Select
                        value={injectionOptions.dbms}
                        onValueChange={(value) => setInjectionOptions({...injectionOptions, dbms: value})}
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select DBMS" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mysql">MySQL</SelectItem>
                          <SelectItem value="oracle">Oracle</SelectItem>
                          <SelectItem value="postgresql">PostgreSQL</SelectItem>
                          <SelectItem value="mssql">Microsoft SQL Server</SelectItem>
                          <SelectItem value="sqlite">SQLite</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tamper">Tamper Scripts</Label>
                      <Input
                        id="tamper"
                        type="text"
                        placeholder="between,randomcase"
                        value={injectionOptions.tamper}
                        onChange={(e) => setInjectionOptions({...injectionOptions, tamper: e.target.value})}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="level">Level</Label>
                        <Select
                          value={injectionOptions.level}
                          onValueChange={(value) => setInjectionOptions({...injectionOptions, level: value})}
                          disabled={isLoading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Default" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="3">3</SelectItem>
                            <SelectItem value="4">4</SelectItem>
                            <SelectItem value="5">5</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="risk">Risk</Label>
                        <Select
                          value={injectionOptions.risk}
                          onValueChange={(value) => setInjectionOptions({...injectionOptions, risk: value})}
                          disabled={isLoading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Default" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="3">3</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="technique">Technique</Label>
                        <Select
                          value={injectionOptions.technique}
                          onValueChange={(value) => setInjectionOptions({...injectionOptions, technique: value})}
                          disabled={isLoading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Default" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="B">Boolean-based</SelectItem>
                            <SelectItem value="E">Error-based</SelectItem>
                            <SelectItem value="U">Union-based</SelectItem>
                            <SelectItem value="S">Stacked queries</SelectItem>
                            <SelectItem value="T">Time-based</SelectItem>
                            <SelectItem value="Q">Inline queries</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  

                  <div className="space-y-4">
                    <h4 className="font-medium">OS Access</h4>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="osShell"
                        checked={osOptions.osShell}
                        onCheckedChange={(checked) => setOsOptions({...osOptions, osShell: checked})}
                        disabled={isLoading}
                      />
                      <Label htmlFor="osShell">OS Shell</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="osPwn"
                        checked={osOptions.osPwn}
                        onCheckedChange={(checked) => setOsOptions({...osOptions, osPwn: checked})}
                        disabled={isLoading}
                      />
                      <Label htmlFor="osPwn">OS Pwn</Label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">General Options</h4>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="flushSession"
                        checked={generalOptions.flushSession}
                        onCheckedChange={(checked) => setGeneralOptions({...generalOptions, flushSession: checked})}
                        disabled={isLoading}
                      />
                      <Label htmlFor="flushSession">Flush Session</Label>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Alert className="bg-gray-800/50 border-gray-700">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <p>• Legal disclaimer: Usage for attacking targets without prior mutual consent is illegal</p>
                  <p>• It is your responsibility to obey all applicable laws</p>
                  <p>• Developers assume no liability for misuse of this tool</p>
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                onClick={handleRunTool}
                disabled={isLoading || 
                  (targetType === "url" && !targetUrl) ||
                  (targetType === "logfile" && !targetFile)}
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
                    Start Scan
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
                <CardTitle>Scan Results</CardTitle>
                <CardDescription>
                  {results.some(line => line.includes('Parameter:')) 
                    ? "Potential SQL injection vulnerabilities detected"
                    : "No vulnerabilities found"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {results.length > 0 ? (
                    <>
                      <div className="bg-black p-4 rounded-md font-mono text-sm overflow-x-auto max-h-96 overflow-y-auto space-y-2">
                        {results.map((result, index) => (
                          <div key={index} className={result.includes('Parameter:') ? 'text-red-400' : ''}>
                            {result}
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
                    <Alert variant={scanCompleted ? "success" : "default"}>
                      {scanCompleted ? (
                        <>
                          <ShieldCheck className="h-4 w-4" />
                          <AlertTitle>No vulnerabilities found</AlertTitle>
                          <AlertDescription>
                            The scan completed successfully but no SQL injection vulnerabilities were detected in the target.
                          </AlertDescription>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="h-4 w-4" />
                          <AlertTitle>Scan in progress</AlertTitle>
                          <AlertDescription>
                            The scan is currently running. Results will appear here when available.
                          </AlertDescription>
                        </>
                      )}
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
              The SQL scan is still running. If you close now, the process will be cancelled.
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