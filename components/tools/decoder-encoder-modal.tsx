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
  RotateCw
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "../ui/alert";

interface DecoderEncoderModalProps {
  tool: Tool;
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (content: string) => void;
}

const ENCODING_TYPES = [
  { value: 'url', label: 'URL' },
  { value: 'html', label: 'HTML' },
  { value: 'base64', label: 'Base64' },
  { value: 'ascii-hex', label: 'ASCII Hex' },
  { value: 'hex', label: 'Hex' },
  { value: 'octal', label: 'Octal' },
  { value: 'binary', label: 'Binary' }
];

export function DecoderEncoderModal({ tool, isOpen, onClose, onSendToChat }: DecoderEncoderModalProps) {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [encodingType, setEncodingType] = useState("url");
  const [operation, setOperation] = useState("encode");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleEncodeDecode = () => {
    try {
      if (!inputText.trim()) {
        setOutputText("");
        return;
      }

      let result = "";
      const text = inputText;

      switch (encodingType) {
        case 'url':
          result = operation === 'encode' 
            ? encodeURIComponent(text) 
            : decodeURIComponent(text);
          break;
        
        case 'html':
          result = operation === 'encode'
            ? text.replace(/[&<>'"]/g, 
                char => ({
                  '&': '&amp;',
                  '<': '&lt;',
                  '>': '&gt;',
                  "'": '&apos;',
                  '"': '&quot;'
                }[char] || char))
            : text.replace(/&amp;|&lt;|&gt;|&apos;|&quot;/g, 
                tag => ({
                  '&amp;': '&',
                  '&lt;': '<',
                  '&gt;': '>',
                  '&apos;': "'",
                  '&quot;': '"'
                }[tag] || tag));
          break;
        
        case 'base64':
          result = operation === 'encode'
            ? btoa(unescape(encodeURIComponent(text)))
            : decodeURIComponent(escape(atob(text)));
          break;
        
        case 'ascii-hex':
          if (operation === 'encode') {
            result = text.split('').map(c => 
              c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
          } else {
            result = text.split(' ').map(hex =>
              String.fromCharCode(parseInt(hex, 16))).join('');
          }
          break;
        
        case 'hex':
          if (operation === 'encode') {
            result = text.split('').map(c => 
              c.charCodeAt(0).toString(16)).join('');
          } else {
            result = text.match(/.{1,2}/g)?.map(hex =>
              String.fromCharCode(parseInt(hex, 16)))?.join('') || '';
          }
          break;
        
        case 'octal':
          if (operation === 'encode') {
            result = text.split('').map(c => 
              c.charCodeAt(0).toString(8).padStart(3, '0')).join(' ');
          } else {
            result = text.split(' ').map(oct =>
              String.fromCharCode(parseInt(oct, 8))).join('');
          }
          break;
        
        case 'binary':
          if (operation === 'encode') {
            result = text.split('').map(c => 
              c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
          } else {
            result = text.split(' ').map(bin =>
              String.fromCharCode(parseInt(bin, 2))).join('');
          }
          break;
        
        default:
          result = "Unsupported encoding type";
      }

      setOutputText(result);
    } catch (error) {
      setOutputText(`Error: ${error instanceof Error ? error.message : 'Invalid input for selected operation'}`);
    }
  };

  const handleSwap = () => {
    setInputText(outputText);
    setOutputText("");
    setOperation(prev => prev === 'encode' ? 'decode' : 'encode');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied to clipboard",
      description: "The output has been copied to your clipboard",
    });
  };

  useEffect(() => {
    handleEncodeDecode();
  }, [inputText, encodingType, operation]);

  return (
    <BaseToolModal tool={tool} isOpen={isOpen} onClose={onClose}>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Decoder/Encoder Tool</CardTitle>
            <CardDescription>
              Convert between different encoding schemes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Input</Label>
                  <Tabs 
                    value={operation} 
                    onValueChange={setOperation}
                    className="w-[180px]"
                  >
                    <TabsList>
                      <TabsTrigger value="encode">Encode</TabsTrigger>
                      <TabsTrigger value="decode">Decode</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Enter text to ${operation}...`}
                  className="min-h-[150px] font-mono"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Output</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
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
                  value={outputText}
                  readOnly
                  placeholder={`${operation === 'encode' ? 'Encoded' : 'Decoded'} result will appear here...`}
                  className="min-h-[150px] font-mono dark:bg-gray-900"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <Label>Encoding Type</Label>
                <Select 
                  value={encodingType} 
                  onValueChange={setEncodingType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select encoding type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENCODING_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                className="mt-6"
                onClick={handleSwap}
              >
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                Swap
              </Button>
            </div>


          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setInputText("");
                setOutputText("");
              }}
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Clear
            </Button>
            {onSendToChat && (
              <Button
                onClick={() => onSendToChat(outputText)}
                disabled={!outputText}
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