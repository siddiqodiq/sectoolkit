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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Copy, 
  Check as CheckIcon,
  Send,
  ArrowLeftRight,
  RotateCw,
  Lock,
  LockOpen
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "../ui/alert";

interface JwtDebuggerModalProps {
  tool: Tool;
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
}

const ALGORITHMS = [
  { value: 'HS256', label: 'HS256' },
  { value: 'HS384', label: 'HS384' },
  { value: 'HS512', label: 'HS512' },
  { value: 'RS256', label: 'RS256' },
  { value: 'RS384', label: 'RS384' },
  { value: 'RS512', label: 'RS512' },
  { value: 'ES256', label: 'ES256' },
  { value: 'ES384', label: 'ES384' },
  { value: 'ES512', label: 'ES512' },
  { value: 'none', label: 'None' }
];

export function JwtDebuggerModal({ tool, isOpen, onClose, onSendToChat }: JwtDebuggerModalProps) {
  const [activeTab, setActiveTab] = useState("decode");
  const [jwtToken, setJwtToken] = useState("");
  const [header, setHeader] = useState("");
  const [payload, setPayload] = useState("");
  const [secret, setSecret] = useState("");
  const [algorithm, setAlgorithm] = useState("HS256");
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (activeTab === 'decode' && jwtToken) {
      decodeJWT();
    }
  }, [jwtToken, activeTab]);

  const decodeJWT = () => {
    try {
      const [headerEncoded, payloadEncoded] = jwtToken.split('.');
      
      if (!headerEncoded || !payloadEncoded) {
        throw new Error("Invalid JWT format");
      }

      const decodedHeader = JSON.parse(atob(headerEncoded));
      const decodedPayload = JSON.parse(atob(payloadEncoded));

      setHeader(JSON.stringify(decodedHeader, null, 2));
      setPayload(JSON.stringify(decodedPayload, null, 2));
      setIsValid(true);
    } catch (error) {
      setHeader("");
      setPayload("");
      setIsValid(false);
      if (jwtToken) {
        toast({
          title: "Decoding failed",
          description: error instanceof Error ? error.message : "Invalid JWT token",
          variant: "destructive",
        });
      }
    }
  };

  const encodeJWT = () => {
    try {
      if (!header || !payload) {
        throw new Error("Header and payload are required");
      }

      const headerObj = JSON.parse(header);
      const payloadObj = JSON.parse(payload);

      const headerEncoded = btoa(JSON.stringify(headerObj));
      const payloadEncoded = btoa(JSON.stringify(payloadObj));

      // In a real implementation, you would use a JWT library to properly sign the token
      // This is a simplified version for demonstration
      const token = `${headerEncoded}.${payloadEncoded}.${algorithm === 'none' ? '' : 'signature'}`;
      
      setJwtToken(token);
      setIsValid(true);
      toast({
        title: "JWT created",
        description: "Token was successfully generated",
      });
    } catch (error) {
      setJwtToken("");
      setIsValid(false);
      toast({
        title: "Encoding failed",
        description: error instanceof Error ? error.message : "Invalid JSON in header or payload",
        variant: "destructive",
      });
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied to clipboard",
      description: "The content has been copied to your clipboard",
    });
  };

  const formatJson = (json: string) => {
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  };

  const clearAll = () => {
    setJwtToken("");
    setHeader("");
    setPayload("");
    setSecret("");
    setIsValid(null);
  };

  return (
    <BaseToolModal tool={tool} isOpen={isOpen} onClose={onClose}>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>JWT Debugger</CardTitle>
            <CardDescription>
              Decode and encode JSON Web Tokens for debugging purposes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="decode">
                  <LockOpen className="h-4 w-4 mr-2" />
                  Decode
                </TabsTrigger>
                <TabsTrigger value="encode">
                  <Lock className="h-4 w-4 mr-2" />
                  Encode
                </TabsTrigger>
              </TabsList>

              <TabsContent value="decode" className="space-y-4">
                <div className="space-y-2">
                  <Label>JWT Token</Label>
                  <Textarea
                    value={jwtToken}
                    onChange={(e) => setJwtToken(e.target.value)}
                    placeholder="Enter JWT token to decode..."
                    className="min-h-[100px] font-mono"
                  />
                </div>

                {isValid !== null && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Header</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(header)}
                        >
                          {copied ? (
                            <CheckIcon className="h-4 w-4 mr-1" />
                          ) : (
                            <Copy className="h-4 w-4 mr-1" />
                          )}
                          Copy
                        </Button>
                      </div>
                      <Textarea
                        value={header}
                        readOnly
                        className="min-h-[100px] font-mono dark:bg-gray-900"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Payload</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(payload)}
                        >
                          {copied ? (
                            <CheckIcon className="h-4 w-4 mr-1" />
                          ) : (
                            <Copy className="h-4 w-4 mr-1" />
                          )}
                          Copy
                        </Button>
                      </div>
                      <Textarea
                        value={payload}
                        readOnly
                        className="min-h-[150px] font-mono dark:bg-gray-900"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 space-y-2">
                        <Label>Verification Secret (optional)</Label>
                        <Input
                          type="text"
                          value={secret}
                          onChange={(e) => setSecret(e.target.value)}
                          placeholder="Enter secret to verify signature"
                        />
                      </div>
                      <Button className="mt-2" disabled={!secret}>
                        Verify
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="encode" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Header</Label>
                    <Textarea
                      value={header}
                      onChange={(e) => setHeader(e.target.value)}
                      placeholder={`{\n  "alg": "HS256",\n  "typ": "JWT"\n}`}
                      className="min-h-[150px] font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Payload</Label>
                    <Textarea
                      value={payload}
                      onChange={(e) => setPayload(e.target.value)}
                      placeholder={`{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}`}
                      className="min-h-[150px] font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>Algorithm</Label>
                    <Select 
                      value={algorithm} 
                      onValueChange={setAlgorithm}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select algorithm" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALGORITHMS.map(alg => (
                          <SelectItem key={alg.value} value={alg.value}>
                            {alg.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1 space-y-2">
                    <Label>Secret Key</Label>
                    <Input
                      type="text"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      placeholder="Enter secret key"
                    />
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={encodeJWT}
                  disabled={!header || !payload}
                >
                  Generate JWT
                </Button>

                {jwtToken && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Generated JWT Token</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(jwtToken)}
                      >
                        {copied ? (
                          <CheckIcon className="h-4 w-4 mr-1" />
                        ) : (
                          <Copy className="h-4 w-4 mr-1" />
                        )}
                        Copy
                      </Button>
                    </div>
                    <Textarea
                      value={jwtToken}
                      readOnly
                      className="min-h-[50px] font-mono dark:bg-gray-900"
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <Alert className="bg-gray-800/50 border-gray-700">
              <AlertDescription className="text-xs space-y-1">
                <p><strong>Decode:</strong> Paste a JWT to view its header and payload</p>
                <p><strong>Encode:</strong> Create a new JWT by specifying header and payload</p>
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={clearAll}
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Clear All
            </Button>
            {onSendToChat && activeTab === 'decode' && (
              <Button
                onClick={() => onSendToChat(`Header:\n${header}\n\nPayload:\n${payload}`)}
                disabled={!header || !payload}
              >
                <Send className="h-4 w-4 mr-2" />
                Send to Chat
              </Button>
            )}
            {onSendToChat && activeTab === 'encode' && (
              <Button
                onClick={() => onSendToChat(jwtToken)}
                disabled={!jwtToken}
              >
                <Send className="h-4 w-4 mr-2" />
                Send to Chat
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </BaseToolModal>
  );
}